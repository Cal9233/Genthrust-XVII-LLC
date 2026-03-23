import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createRateLimiter } from '@/lib/rate-limit'
export const dynamic = 'force-dynamic'

const ContactSchema = z.object({
  name: z.string().min(1).max(200).transform(v => v.trim()),
  email: z.string().email().max(255),
  phone: z.string().max(30).optional().default(''),
  company: z.string().max(200).optional().default(''),
  subject: z.string().min(1).max(300).transform(v => v.trim()),
  message: z.string().min(1).max(5000).transform(v => v.trim()),
})

const contactLimiter = createRateLimiter({ maxAttempts: 3, windowMs: 10 * 60_000, name: 'contact' })

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
    const rateCheck = await contactLimiter.check(ip)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) } }
      )
    }
    await contactLimiter.record(ip)

    const body = await request.json()
    const parsed = ContactSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, email, phone, company, subject, message } = parsed.data

    // TODO: Configure email service (Resend, SendGrid, Nodemailer, etc.)
    // For now, this is a placeholder that logs the email
    // Replace this with actual email sending logic
    
    const emailContent = {
      to: 'sales@genthrust.net',
      from: email,
      subject: `Contact Form: ${subject}`,
      text: `
Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Company: ${company || 'Not provided'}

Message:
${message}
      `.trim(),
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${phone ? escapeHtml(phone) : 'Not provided'}</p>
        <p><strong>Company:</strong> ${company ? escapeHtml(company) : 'Not provided'}</p>
        <h3>Message:</h3>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `,
    }

    // Log for development (remove in production)
    console.log('Contact form submission:', emailContent)

    // Example with Resend (uncomment and configure):
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from: 'contact@genthrust.net',
    //   to: 'sales@genthrust.net',
    //   subject: emailContent.subject,
    //   html: emailContent.html,
    //   replyTo: email,
    // })

    // Example with SendGrid (uncomment and configure):
    // const sgMail = require('@sendgrid/mail')
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY)
    // await sgMail.send({
    //   to: 'sales@genthrust.net',
    //   from: 'contact@genthrust.net',
    //   subject: emailContent.subject,
    //   text: emailContent.text,
    //   html: emailContent.html,
    //   replyTo: email,
    // })

    // For now, return success (replace with actual email sending)
    return NextResponse.json(
      { message: 'Message sent successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    )
  }
}

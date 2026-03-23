import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
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

    const emailSubject = `Contact Form: ${subject}`
    const emailText = `Name: ${name}
Email: ${email}
Phone: ${phone || 'Not provided'}
Company: ${company || 'Not provided'}

Message:
${message}`
    const emailHtml = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${phone ? escapeHtml(phone) : 'Not provided'}</p>
      <p><strong>Company:</strong> ${company ? escapeHtml(company) : 'Not provided'}</p>
      <h3>Message:</h3>
      <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
    `

    if (!process.env.RESEND_API_KEY) {
      console.warn('[contact] RESEND_API_KEY is not set — email not sent. Submission:', {
        name,
        email,
        phone,
        company,
        subject: emailSubject,
        message,
      })
    } else {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error: sendError } = await resend.emails.send({
        from: 'contact@genthrust.net',
        to: 'sales@genthrust.net',
        replyTo: email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      })
      if (sendError) {
        console.error('[contact] Resend delivery error:', sendError)
        return NextResponse.json(
          { error: 'Failed to send message. Please try again later.' },
          { status: 500 }
        )
      }
    }

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

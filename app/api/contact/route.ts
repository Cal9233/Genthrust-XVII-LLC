import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// In-memory rate limiter: 3 requests per 10 minutes per IP
// ---------------------------------------------------------------------------
const contactRateLimitMap = new Map<string, { count: number; resetAt: number }>()
const CONTACT_RATE_WINDOW_MS = 10 * 60_000
const CONTACT_RATE_MAX = 3

function checkContactRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = contactRateLimitMap.get(ip)
  if (!entry || now >= entry.resetAt) {
    contactRateLimitMap.set(ip, { count: 1, resetAt: now + CONTACT_RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= CONTACT_RATE_MAX) return false
  entry.count++
  return true
}

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of contactRateLimitMap) {
    if (now >= entry.resetAt) contactRateLimitMap.delete(key)
  }
}, 60_000).unref?.()

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
    if (!checkContactRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name, email, phone, company, subject, message } = body

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

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

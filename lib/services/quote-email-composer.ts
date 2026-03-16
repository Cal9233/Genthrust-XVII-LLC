// Quote Email Composer Service
// Generates HTML email responses and sends via M365 Graph API
// Ported from Genthrust_Inventory emailTemplates + microsoftGraphService

interface PartInfo {
  part_number: string
  description?: string
  location?: string
  quantity?: number
}

// ─── Email Templates ──────────────────────────────────────────────

function partFoundTemplate(data: {
  parts: PartInfo[]
  senderName: string
}): string {
  const rows = data.parts
    .map(
      (p) => `
    <tr>
      <td style="border:1px solid #dee2e6;padding:8px">${p.part_number}</td>
      <td style="border:1px solid #dee2e6;padding:8px">${p.description || 'N/A'}</td>
      <td style="border:1px solid #dee2e6;padding:8px">${p.location || 'N/A'}</td>
      <td style="border:1px solid #dee2e6;padding:8px;text-align:right">${p.quantity ?? 'N/A'}</td>
    </tr>`
    )
    .join('')

  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#333">Parts Availability Report</h2>
  <p>Dear ${data.senderName || 'Customer'},</p>
  <p>Thank you for your inquiry. Below is the availability information for the requested parts:</p>
  <table style="width:100%;border-collapse:collapse;margin:20px 0">
    <thead>
      <tr style="background-color:#f8f9fa">
        <th style="border:1px solid #dee2e6;padding:8px;text-align:left">Part Number</th>
        <th style="border:1px solid #dee2e6;padding:8px;text-align:left">Description</th>
        <th style="border:1px solid #dee2e6;padding:8px;text-align:left">Location</th>
        <th style="border:1px solid #dee2e6;padding:8px;text-align:right">Quantity</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p>Please let us know if you would like to proceed with an order or need any additional information.</p>
  <p>Best regards,<br>Genthrust XVII LLC</p>
</div>`
}

function partNotFoundTemplate(data: {
  notFoundParts: string[]
  senderName: string
}): string {
  const items = data.notFoundParts.map((p) => `<li style="padding:5px 0">&#10060; ${p}</li>`).join('')

  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#333">Parts Availability Update</h2>
  <p>Dear ${data.senderName || 'Customer'},</p>
  <p>Thank you for your inquiry. Unfortunately, the following parts are not currently in our inventory:</p>
  <ul style="list-style-type:none;padding:0">${items}</ul>
  <p>We can check with our suppliers for availability or suggest alternative solutions. Please let us know how you would like to proceed.</p>
  <p>Best regards,<br>Genthrust XVII LLC</p>
</div>`
}

function mixedResultsTemplate(data: {
  foundParts: PartInfo[]
  notFoundParts: string[]
  senderName: string
}): string {
  const foundRows = data.foundParts
    .map(
      (p) => `
    <tr>
      <td style="border:1px solid #c3e6cb;padding:8px">${p.part_number}</td>
      <td style="border:1px solid #c3e6cb;padding:8px">${p.description || 'N/A'}</td>
      <td style="border:1px solid #c3e6cb;padding:8px">${p.location || 'N/A'}</td>
      <td style="border:1px solid #c3e6cb;padding:8px;text-align:right">${p.quantity ?? 'N/A'}</td>
    </tr>`
    )
    .join('')

  const notFoundItems = data.notFoundParts
    .map((p) => `<li style="padding:5px 0;color:#dc3545">&bull; ${p}</li>`)
    .join('')

  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#333">Parts Availability Report</h2>
  <p>Dear ${data.senderName || 'Customer'},</p>
  <p>Thank you for your inquiry. Here's the availability status for your requested parts:</p>
  <h3 style="color:#28a745;margin-top:20px">&#10003; Available Parts:</h3>
  <table style="width:100%;border-collapse:collapse;margin:10px 0">
    <thead>
      <tr style="background-color:#d4edda">
        <th style="border:1px solid #c3e6cb;padding:8px;text-align:left">Part Number</th>
        <th style="border:1px solid #c3e6cb;padding:8px;text-align:left">Description</th>
        <th style="border:1px solid #c3e6cb;padding:8px;text-align:left">Location</th>
        <th style="border:1px solid #c3e6cb;padding:8px;text-align:right">Quantity</th>
      </tr>
    </thead>
    <tbody>${foundRows}</tbody>
  </table>
  <h3 style="color:#dc3545;margin-top:20px">&#10007; Not Available:</h3>
  <ul style="list-style-type:none;padding:0">${notFoundItems}</ul>
  <p>For the unavailable parts, we can check with our suppliers or suggest alternatives. Please let us know how you would like to proceed.</p>
  <p>Best regards,<br>Genthrust XVII LLC</p>
</div>`
}

function customTemplate(data: {
  content: string
  senderName: string
}): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <p>Dear ${data.senderName || 'Customer'},</p>
  ${data.content}
  <p>Best regards,<br>Genthrust XVII LLC</p>
</div>`
}

export type TemplateName = 'partFound' | 'partNotFound' | 'mixedResults' | 'custom'

export function generateEmailHtml(
  template: TemplateName,
  data: any
): { subject: string; body: string } {
  switch (template) {
    case 'partFound':
      return {
        subject: `Parts Availability - ${(data.partNumbers || []).join(', ')}`,
        body: partFoundTemplate(data),
      }
    case 'partNotFound':
      return {
        subject: `Parts Inquiry - ${(data.partNumbers || []).join(', ')}`,
        body: partNotFoundTemplate(data),
      }
    case 'mixedResults':
      return {
        subject: 'Parts Availability - Mixed Results',
        body: mixedResultsTemplate(data),
      }
    case 'custom':
      return {
        subject: data.subject || 'Quote Response',
        body: customTemplate(data),
      }
  }
}

export const EMAIL_TEMPLATES = [
  { id: 'partFound', name: 'Parts Found', description: 'Use when all requested parts are in stock' },
  { id: 'partNotFound', name: 'Parts Not Found', description: 'Use when none of the requested parts are in stock' },
  { id: 'mixedResults', name: 'Mixed Results', description: 'Use when some parts are found and others are not' },
  { id: 'custom', name: 'Custom Message', description: 'Write your own custom response' },
] as const

// ─── Graph API Email Sender ───────────────────────────────────────

export async function sendEmailViaGraph(
  accessToken: string,
  options: { to: string; subject: string; body: string; cc?: string[] }
): Promise<void> {
  const message: any = {
    message: {
      subject: options.subject,
      body: { contentType: 'HTML', content: options.body },
      toRecipients: [{ emailAddress: { address: options.to } }],
    },
  }

  if (options.cc?.length) {
    message.message.ccRecipients = options.cc.map((email) => ({
      emailAddress: { address: email },
    }))
  }

  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Graph API send error (${response.status}): ${text}`)
  }
}

export async function replyToEmailViaGraph(
  accessToken: string,
  emailId: string,
  comment: string
): Promise<void> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${emailId}/reply`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment }),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Graph API reply error (${response.status}): ${text}`)
  }
}

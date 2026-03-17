'use client'

import { Phone, Mail, MapPin } from 'lucide-react'
import Image from 'next/image'
import { FOOTER_LINKS } from '@/lib/constants'

export function Footer() {
  return (
    <footer className="relative bg-gray-50 border-t border-gray-200">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo & About */}
          <div className="lg:col-span-1">
            <a href="/" className="flex items-center gap-2 mb-4">
              <Image
                src="/GenLogoTab.png"
                alt="GENTHRUST XVII Logo"
                width={32}
                height={32}
                className="h-8 w-auto"
              />
              <span className="text-lg font-bold tracking-wider text-black">
                GENTHRUST
              </span>
              <span className="text-sm font-medium text-burgundy-400">
                XVII
              </span>
            </a>
            <p className="text-black text-sm leading-relaxed">
              Supplying aircraft parts and components of the highest quality.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-black font-semibold mb-4 text-sm">
              Quick Links
            </h4>
            <ul className="space-y-1">
              {FOOTER_LINKS.quickLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-black hover:text-gray-700 transition-colors text-sm py-2 block"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-black font-semibold mb-4 text-sm">
              Contact
            </h4>
            <ul className="space-y-1 text-sm">
              <li className="flex items-center gap-2 text-black py-2">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="min-w-0">{FOOTER_LINKS.contact.address}</span>
              </li>
              <li>
                <a
                  href={`tel:${FOOTER_LINKS.contact.phone.replace(/[^+\d]/g, '')}`}
                  className="flex items-center gap-2 text-black hover:text-gray-700 transition-colors py-2"
                >
                  <Phone className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="min-w-0">{FOOTER_LINKS.contact.phone}</span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${FOOTER_LINKS.contact.email}`}
                  className="flex items-center gap-2 text-black hover:text-gray-700 transition-colors py-2"
                >
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="min-w-0">{FOOTER_LINKS.contact.email}</span>
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-black text-sm">
            &copy; {new Date().getFullYear()} GENTHRUST XVII LLC. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm">
            <a href="#" className="text-black hover:text-gray-700 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-black hover:text-gray-700 transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

import AppNav from './AppNav';
import SiteFooter from './SiteFooter';

type LegalKind = 'terms' | 'privacy' | 'refunds';

interface Section {
  heading: string;
  paragraphs: string[];
}

const CONTENT: Record<LegalKind, { title: string; updated: string; sections: Section[] }> = {
  terms: {
    title: 'Terms of use',
    updated: '4 November 2026',
    sections: [
      {
        heading: 'Private beta',
        paragraphs: [
          'Umnotho is currently a private beta operated by Bongytech. Features, prices, and availability may change, and access may be limited or suspended. By using the service you agree to these terms.',
          'This is a template for a small beta. Have a qualified South African lawyer review it before a public launch.',
        ],
      },
      {
        heading: 'Eligibility and accounts',
        paragraphs: [
          'You must be at least 18 years old and able to enter into a binding agreement. You are responsible for the activity on your account and for keeping your login credentials secure.',
          'Do not impersonate another person, create accounts to evade restrictions, or use the service for unlawful activity.',
        ],
      },
      {
        heading: 'Barter listings and trades',
        paragraphs: [
          'Umnotho provides a venue for people to discover each other and negotiate trades. We are not a party to a trade and do not guarantee that a listing is accurate, lawful, safe, or available.',
          'You are responsible for inspecting goods, agreeing on delivery, complying with applicable law, and paying any taxes that apply to your trade.',
        ],
      },
      {
        heading: 'Crypto subscription payments',
        paragraphs: [
          'Paid plans are priced in South African rand and settled in USDT through a third-party hosted checkout provider. The crypto amount is quoted at checkout and may be affected by exchange rates, network fees, and confirmations.',
          'Crypto transfers are generally irreversible. You are responsible for sending the correct asset on the correct network to the address or checkout shown. We do not ask for private keys or seed phrases, and you should never share them.',
          'A paid plan is activated only after the payment provider confirms settlement. We may suspend or reverse a plan if a payment is reversed, fraudulent, or made in error.',
        ],
      },
      {
        heading: 'Acceptable use',
        paragraphs: [
          'Do not post illegal, stolen, counterfeit, dangerous, or prohibited items; harass other users; attempt to bypass security controls; scrape the service; or interfere with its operation.',
          'We may remove content, suspend accounts, or report suspected unlawful activity.',
        ],
      },
      {
        heading: 'Disclaimers and liability',
        paragraphs: [
          'The service is provided “as is” and “as available” to the extent permitted by law. We do not provide financial, investment, tax, or legal advice.',
          'To the maximum extent permitted by law, Bongytech is not liable for indirect or consequential loss, loss of data, failed trades, or losses caused by third-party payment providers or blockchain networks.',
          'Nothing in these terms limits rights you cannot waive under South African consumer law.',
        ],
      },
      {
        heading: 'Changes and contact',
        paragraphs: [
          'We may update these terms; material changes will be posted on this page. Continued use after an update means you accept the revised terms.',
          'Questions: bongy.tech@gmail.com.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy notice',
    updated: '4 November 2026',
    sections: [
      {
        heading: 'Who we are',
        paragraphs: [
          'Umnotho is operated by Bongytech in South Africa. This notice explains what personal information the private beta processes and why.',
          'This is a template, not legal advice. Confirm your POPIA/GDPR obligations with a qualified adviser before a public launch.',
        ],
      },
      {
        heading: 'Information we collect',
        paragraphs: [
          'Account data: email address, display name, authentication identifiers, and (for Google sign-in) the profile information Google returns.',
          'Marketplace data: listings, questions, offers, messages, ratings, and the city you choose to share.',
          'Payment data: plan, amount, payment status, provider reference, transaction hash, and timestamps. We do not receive or store your card number, private keys, or seed phrase.',
          'Technical data: browser/device information and security logs needed to operate and protect the service.',
        ],
      },
      {
        heading: 'How we use it',
        paragraphs: [
          'To create and secure accounts, operate listings and trades, process and verify payments, prevent abuse, provide support, and meet legal obligations.',
          'We use Firebase Authentication and Firestore (Google) for the app backend, and a crypto payment provider for checkout. Those providers process data under their own terms and privacy policies.',
        ],
      },
      {
        heading: 'Sharing and retention',
        paragraphs: [
          'We share only what is needed with infrastructure and payment providers, or where required by law. We do not sell personal information.',
          'We retain account and payment records for as long as needed to operate the beta and meet tax, fraud-prevention, and legal requirements, then delete or anonymise them.',
        ],
      },
      {
        heading: 'Your choices and rights',
        paragraphs: [
          'You can update your display name, delete listings you own, and ask for access, correction, or deletion of your personal information by emailing bongy.tech@gmail.com.',
          'You may also complain to the South African Information Regulator. We will respond to requests within a reasonable period.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'We use Firebase Authentication, Firestore security rules, server-side payment verification, and least-privilege deployment credentials. No system is perfectly secure; report suspected issues to bongy.tech@gmail.com rather than publicly.',
        ],
      },
    ],
  },
  refunds: {
    title: 'Refund policy',
    updated: '4 November 2026',
    sections: [
      {
        heading: 'Crypto payments are generally final',
        paragraphs: [
          'Crypto transfers are irreversible. Once a payment is confirmed and a plan is activated, we do not automatically refund it because you changed your mind or because the asset price moved.',
          'This does not override rights you may have under South African consumer law where they apply.',
        ],
      },
      {
        heading: 'Wrong amount, wrong asset, or wrong network',
        paragraphs: [
          'If you sent the wrong amount, asset, or network, contact bongy.tech@gmail.com with the payment reference, transaction hash, and a screenshot. Recovery may not be possible, and the payment provider may charge a fee.',
          'Underpayments are not activated automatically. We may ask you to complete the remaining amount or may cancel the checkout.',
        ],
      },
      {
        heading: 'Failed or duplicate payments',
        paragraphs: [
          'If a payment failed but your wallet shows a confirmed transfer, or you paid twice for the same plan, contact us with the transaction details. We will investigate with the provider and, where the payment is verifiably duplicated, offer a refund or account credit.',
        ],
      },
      {
        heading: 'Subscriptions and cancellation',
        paragraphs: [
          'Plans are currently prepaid for a fixed period and do not auto-renew unless explicitly stated at checkout. Cancelling stops future purchases; it does not automatically refund the current period.',
        ],
      },
      {
        heading: 'How to request a review',
        paragraphs: [
          'Email bongy.tech@gmail.com with “Refund review” in the subject, your account email, payment reference, transaction hash, and what happened. We aim to acknowledge requests within a few business days.',
        ],
      },
    ],
  },
};

export default function LegalPage({ kind }: { kind: LegalKind }) {
  const content = CONTENT[kind];

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      <AppNav />
      <main className="flex-1 px-6 py-16">
        <article className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-umnotho mb-2">
            Legal
          </p>
          <h1 className="text-4xl font-display font-bold text-white mb-2">{content.title}</h1>
          <p className="text-sm text-gray-500 mb-10">Last updated: {content.updated}</p>

          <div className="space-y-8">
            {content.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl font-display font-semibold text-white mb-3">
                  {section.heading}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-gray-400 mb-3">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>

          <p className="mt-12 rounded-xl border border-white/5 bg-dark-900 p-4 text-xs text-gray-500">
            This is a beta-stage template and not legal advice. Have it reviewed by a qualified
            South African lawyer before a public launch.
          </p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

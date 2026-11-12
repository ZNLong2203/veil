import type { Explanation, Triage } from '../ai/tasks'
import { SAMPLES } from '../samples'
import type { Session } from '../state/useSession'

/**
 * Development only (loaded behind `import.meta.env.DEV`, so it is not in production builds).
 * Shows the result screen from a fixture so the UI can be designed without a model call.
 * Placeholders match what the rule detectors produce for the "Hospital bill" sample.
 * Totals check out: 2,310 + 1,845 + 3,200 + 1,150 = 8,505; 8,505 - 2,950 - 1,800 = 3,755.
 */
export const PREVIEW_EXPLANATION: Explanation = {
  documentType: 'Medical bill',
  plainSummary:
    '[PERSON_1], this is a hospital statement for an emergency visit on 14 September 2026. After your insurance paid $1,800 and a $2,950 adjustment, you still owe $3,755. The biggest surprise is that the anesthesiologist, Dr. [PERSON_2], was out of network and billed $3,200 separately.',
  keyFacts: [
    { label: 'Total billed', value: '$8,505.00' },
    { label: 'Insurance adjustment', value: '-$2,950.00' },
    { label: 'Insurance paid', value: '-$1,800.00' },
    { label: 'Balance due', value: '$3,755.00' },
    { label: 'Date of service', value: '14 Sept 2026' },
    { label: 'Claim number', value: '[IDNUM_2]' },
  ],
  deadlines: [
    {
      what: 'Pay the balance or arrange a payment plan',
      date: '15 Dec 2026',
      consequence: 'After this date the account may be sent to collections and reported to credit bureaus.',
    },
    {
      what: 'Ask for an itemized bill or financial assistance',
      date: 'Within 30 days',
      consequence: 'Call [PHONE_2] before the 30 days from the statement date run out.',
    },
  ],
  redFlags: [
    {
      issue: 'Out-of-network anesthesiologist billed $3,200',
      whyItMatters:
        'For emergency care you may be protected from surprise out-of-network bills. Ask your insurer and the hospital whether this charge should be reduced.',
      severity: 'high',
    },
    {
      issue: 'Threat of collections after 15 Dec',
      whyItMatters: 'A collections referral can lower your credit score. If you set up a payment plan, get it in writing.',
      severity: 'medium',
    },
    {
      issue: 'A full card number is printed on the statement',
      whyItMatters: 'Paper with a full card number is a security risk. Ask billing to remove it from their records.',
      severity: 'low',
    },
  ],
  questionsToAsk: [
    'Was the anesthesiologist’s charge reviewed under surprise-billing rules for emergency care?',
    'Can you send an itemized bill with billing codes for every line?',
    'What financial assistance programs am I eligible for, and what is the deadline to apply?',
  ],
  nextSteps: [
    'Call the billing office on [PHONE_2] and request an itemized bill.',
    'Ask your insurer for the explanation of benefits for claim [IDNUM_2].',
    'Dispute the out-of-network anesthesia charge in writing and keep a copy.',
    'Put the 15 Dec payment deadline in your calendar, with a reminder a week before.',
  ],
}

export const PREVIEW_TRIAGE: Triage & { executedOn: 'ON_DEVICE' } = {
  documentType: 'medical bill',
  urgency: 'high',
  language: 'English',
  executedOn: 'ON_DEVICE',
}

export function applyPreview(loadPreview: Session['loadPreview']) {
  const bill = SAMPLES.find((x) => x.id === 'bill')!.text
  loadPreview(bill, PREVIEW_EXPLANATION, PREVIEW_TRIAGE)
}

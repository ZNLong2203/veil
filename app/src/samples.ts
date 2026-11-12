/**
 * Demo documents. Every person, address, number and organisation below is fictional.
 * (555-01xx phone numbers, 9xx SSNs and the 4111… card number are reserved test values.)
 */
export interface Sample {
  id: string
  title: string
  blurb: string
  text: string
}

export const SAMPLES: Sample[] = [
  {
    id: 'bill',
    title: 'Hospital bill',
    blurb: 'Out-of-network surprise charges',
    text: `RIVERSIDE MEDICAL CENTER — PATIENT STATEMENT

Patient: Jordan Rivera
Date of birth: 04/12/1988
Address: 1420 Maple Street, Apt 4B, Portland, OR 97205
Phone: (415) 555-0132     Email: jordan.rivera@example.com
Member ID: BX-4471-9920     Claim number: CLM-88231-77

Date of service: 2026-09-14
Emergency department visit ...... $2,310.00
Radiology (CT abdomen) ...... $1,845.00
Anesthesia — Dr. Chen (OUT OF NETWORK) ...... $3,200.00
Facility fee ...... $1,150.00
Insurance adjustment ...... -$2,950.00
Amount insurance paid ...... -$1,800.00

BALANCE DUE: $3,755.00

Payment is due by 2026-12-15. Accounts unpaid after that date may be referred
to collections and reported to credit bureaus. To request an itemized bill or
financial assistance, call (415) 555-0178 within 30 days of this statement.
Pay by card or send a cheque payable to Riverside Medical Center, Billing Dept.
Card on file: 4111 1111 1111 1111`,
  },
  {
    id: 'lease',
    title: 'Rent increase notice',
    blurb: 'Notice from a landlord',
    text: `NOTICE OF RENT INCREASE AND LEASE CHANGE

Tenant: Priya Natarajan
Premises: 77 Harbor View Road, Unit 12, Oakland, CA 94607
Landlord: Gable & Finch Property Management
Contact: leasing@gablefinch.example   Tel: +1 510 555 0114

Dear Ms. Natarajan,

Effective 2027-01-01 your monthly rent will increase from $2,150 to $2,590.
This notice is delivered 31 days before the effective date.

Your lease is amended as follows:
1. A new "amenity and package fee" of $85 per month will be added.
2. The late fee increases to 10% of monthly rent after a 2-day grace period.
3. Your security deposit of $2,150 will be re-assessed; any shortfall must be
   paid within 14 days of this notice.
4. Tenants who do not sign and return the acknowledgement below by 2026-12-10
   will be treated as month-to-month and may be given 30 days notice to vacate.

Applicant SSN on file: 912-33-4821
Bank account for autopay: account number 004455667788

Sincerely,
Marcus Finch, Property Manager`,
  },
  {
    id: 'denial',
    title: 'Insurance denial',
    blurb: 'Claim denied, appeal window',
    text: `NORTHSTAR HEALTH PLAN — NOTICE OF ADVERSE BENEFIT DETERMINATION

Insured: Amara Okafor
Date of birth: March 3, 1994
Address: 58 Linden Avenue, Austin, TX 78701
Policy number: NHP-7730021   Claim number: 2026-5519-0042

We have reviewed the claim for an MRI of the left knee performed on 2026-08-02
by Dr. Elena Park. The claim is denied because the service was considered
"not medically necessary" and prior authorization was not obtained.

You have the right to appeal. Your appeal must be filed in writing within
180 days of the date of this letter (2026-10-20). Include any supporting
documents from your treating physician. You may request an expedited review
if the delay could seriously jeopardise your health. You may also request, free
of charge, copies of the clinical guidelines used to make this decision.

Questions? Call member services at (512) 555-0166 or write to
appeals@northstar.example`,
  },
]

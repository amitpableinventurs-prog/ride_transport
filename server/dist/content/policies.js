"use strict";
// Policy pages (and About / Contact) published to the CMS with `npm run publish:policies`.
// Plain text, as the CMS stores it: blank lines separate blocks, a block that is a single
// "N. Heading" line is a section heading, and lines starting with "• " are list items.
// Amounts the admin can change in Settings (free cancellation window, free waiting time, rider
// dues limit, minimum payout) are not written here; the text points to the app instead.
Object.defineProperty(exports, "__esModule", { value: true });
exports.POLICIES = void 0;
const terms = `These Terms & Conditions ("Terms") apply when you use the AnZ Cabs customer app, website and services to book rides or deliveries. By creating an account or making a booking you agree to these Terms, our Privacy Policy, Cancellation Policy and Refund Policy.

1. Who we are

AnZ Cabs ("AnZ Cabs", "we", "us") runs a technology platform that connects customers with independent riders and transport partners who provide bike, auto, cab, rental and goods delivery services. The rider or transport partner who accepts your booking provides the transport. We provide the app, matching, payments, support and safety features.

2. Your account

• You must be at least 18 years old to create an account.
• You sign in with your mobile number and a one-time password (OTP). Keep your phone and OTPs private.
• Give accurate details and keep them up to date. You are responsible for all bookings made from your account.
• One person may hold only one customer account.

3. Making a booking

• Before you book, the app shows the fare for each available vehicle type for your pickup and drop.
• A booking is confirmed when a rider accepts it. We do our best to find a rider but cannot guarantee one will be available.
• Share your trip OTP only with the rider who has arrived in the vehicle shown in the app. The trip starts only after the correct OTP is entered.
• You can schedule a booking in advance. We start looking for a rider shortly before the scheduled time.
• Changing the drop or adding stops during a trip updates the fare.

4. Fares and charges

The fare is calculated by the app for the vehicle type, city and route. It can include:

• A base fare, a distance charge and a time charge.
• Waiting charges if the rider waits at pickup beyond the free waiting time shown in the app.
• Night charges for trips between 10 PM and 6 AM, where applicable.
• Charges for extra drops and for loading help on deliveries, when you choose them.
• A platform fee and applicable taxes.
• Discounts from valid coupons.

The final fare can differ from the estimate if the route, drop, stops or waiting time change. The fare breakdown is shown in the app and on the trip invoice.

Tips are optional. You can add a tip from your AnZ Cabs wallet when you rate a trip, and the full tip goes to the rider.

5. Payments

• You can pay the rider in cash, or pay in the app by UPI, debit or credit card, netbanking or your AnZ Cabs wallet.
• Online payments are processed by our payment partner (Razorpay). We do not store your card number, CVV or UPI PIN.
• If you choose wallet payment and the balance is not enough when the trip ends, you can pay the fare online from the app instead.
• Pay for every completed trip. Unpaid amounts are recorded against your account and may need to be cleared before your next booking.

6. AnZ Cabs wallet

• You can add ₹10 to ₹10,000 at a time to your wallet and use it to pay for trips, tips and charges on AnZ Cabs.
• Refunds may be credited to the wallet as described in the Refund Policy.
• The wallet balance can be used only on AnZ Cabs. It cannot be transferred to another person or withdrawn to a bank account.

7. Cancellations

You can cancel a booking from the app free of charge, as explained in our Cancellation Policy.

8. Deliveries

• Describe the goods correctly, pack them safely and give the correct receiver name and number for every drop.
• The rider photographs the goods at pickup. Each drop is completed with the receiver's OTP and a proof-of-delivery photo.
• Do not send illegal or prohibited items, including drugs, weapons, explosives, flammable or hazardous substances, live animals, cash, jewellery or other high-value items, or anything that needs a special licence to carry.
• Riders may refuse goods that are prohibited, unsafe, badly packed or larger than the vehicle can carry.
• We are not responsible for loss or damage caused by poor packing, an incorrect description or prohibited items.

9. Using the service responsibly

• Treat riders with respect. Harassment, abuse, threats or discrimination are not allowed.
• Do not carry more passengers than the vehicle is meant for, and do not ask the rider to break traffic rules.
• Do not smoke, consume alcohol or carry illegal items during a ride.
• You are responsible for damage you cause to a rider's vehicle, including cleaning costs.
• Do not misuse coupons, referral rewards or the app, or create bookings you do not intend to take.

10. Safety features

The app lets you share a live link to your trip and use SOS, which alerts our team with your trip and location. In an emergency, also call 112.

11. Ratings

You and your rider can rate each other after a trip. Ratings help us maintain quality. Do not post false, abusive or offensive comments.

12. Lost items

If you leave something in a vehicle, contact us through Help & Support in the app. We will try to connect you with the rider, but we are not responsible for lost items.

13. Our responsibility

• Riders and transport partners are independent and are responsible for the transport they provide.
• We are not responsible for delays caused by traffic, weather, road closures or other events outside our control.
• To the extent permitted by law, our total liability for any booking is limited to the amount you paid for that booking. This does not limit any rights you have under Indian consumer protection law.

14. Suspension and termination

We may suspend or close an account that breaks these Terms, misuses the service, leaves dues unpaid or puts others at risk. You can stop using the service at any time.

15. Deleting your account

You can request account deletion from the app. We complete it within 7 days once any dues are settled. Some trip, payment and tax records are kept for the period required by law, as described in our Privacy Policy.

16. Changes to these Terms

We may update these Terms. We will show the updated date on this page and tell you in the app about important changes. Using the service after a change means you accept the updated Terms.

17. Governing law

These Terms are governed by the laws of India. Disputes are subject to the jurisdiction of the courts where AnZ Cabs has its registered office.

18. Help and grievances

Contact us through Help & Support in the app or on our Contact Us page, which also lists our Grievance Officer. We acknowledge complaints within 48 hours and aim to resolve them within one month.`;
const privacy = `This Privacy Policy explains what personal data AnZ Cabs ("we", "us") collects when you use the AnZ Cabs customer app and website, how we use and share it, and the choices you have. We process personal data in line with the Digital Personal Data Protection Act, 2023 and other applicable Indian laws.

1. Data we collect

• Account details: your name, mobile number, and if you add them, email address, profile photo and language preference.
• Location: your precise location while you use the app to set a pickup point and during an active trip, so riders can reach you and the trip can be tracked.
• Trip details: pickup, drop and stops, route, distance, fares, payment method, ratings and comments, and messages exchanged with your rider in the app.
• Saved places: addresses you save, such as Home and Work, and places from your recent trips.
• Delivery details: receiver names and mobile numbers, goods descriptions, and photos of goods taken at pickup and delivery.
• Payment details: transaction amounts, status and references from our payment partner. We do not store your card number, CVV or UPI PIN.
• Wallet and referral details: wallet transactions, coupons used and referral codes.
• Support and safety: help requests, SOS alerts and the trip and location details sent with them.
• Device details: device model, operating system, app version and the notification token used to send you alerts.

2. How we use your data

• To create your account and verify your mobile number.
• To show fares, match you with a nearby rider and run the trip or delivery.
• To process payments, wallet transactions, refunds and invoices.
• To send trip updates, OTPs and service notifications.
• To provide support, investigate complaints and respond to SOS alerts.
• To keep the platform safe, prevent fraud and enforce our Terms.
• To improve our services, pricing and coverage using aggregated data.
• To meet legal, tax and regulatory obligations.

3. Who can see your data

• Your rider: during an active trip, your rider sees your name, profile photo, rating, pickup and drop, and your mobile number so they can call you about the pickup. Your number is no longer shown to the rider after the trip ends. Your rider's number is not shown to you.
• People you share a trip with: anyone with your live trip link can see the trip's progress until it ends.
• Service providers who work for us: payment processing (Razorpay), maps, routes and addresses (Google Maps Platform), SMS for OTPs, push notifications (Firebase Cloud Messaging) and cloud hosting. They may use the data only to provide their service to us.
• Authorities: when required by law, a court order or to protect someone's safety.
• A buyer or successor if AnZ Cabs is merged, acquired or restructured, under the same protections.

We do not sell your personal data.

4. How long we keep data

We keep your data while your account is active. After you delete your account, we delete or anonymise your personal data within a reasonable time, except trip, payment, invoice and tax records, which we keep for the period required by law, and data needed to resolve disputes or prevent fraud.

5. Your rights

You can:

• See and update your profile details in the app.
• Ask for a summary of the personal data we hold about you.
• Ask us to correct or delete your personal data.
• Withdraw consent for optional processing. Some data is needed to provide rides, so withdrawing consent for it may mean we cannot serve you.
• Nominate someone to exercise your rights if you die or become unable to.
• Raise a grievance with us and, if not resolved, with the Data Protection Board of India.

To use these rights, contact us through Help & Support in the app or on our Contact Us page.

6. Security

We protect your data with access controls, encrypted connections and limited staff access. No system is completely secure, so keep your phone and OTPs private and tell us at once if you notice anything unusual.

7. Children

Our services are for people aged 18 and over. We do not knowingly create accounts for children.

8. Changes to this policy

We may update this policy. The updated date is shown on this page, and we will tell you in the app about important changes.

9. Contact and Grievance Officer

Contact us through Help & Support in the app. Our Grievance Officer's details are on the Contact Us page.`;
const cancellation = `This policy explains when you can cancel a booking on AnZ Cabs and what happens when a rider cancels.

1. Cancelling is free

AnZ Cabs does not charge a cancellation fee. You can cancel a booking from the app at no cost while we are looking for a rider, after a rider accepts and after the rider arrives at your pickup point, as long as the trip has not started.

2. If no rider is found

If no rider accepts your booking, nothing is charged. You can try again from the app.

3. If the rider cancels

If your rider cancels, you are not charged. We automatically look for another rider for the same booking.

4. Scheduled bookings

A scheduled booking can be cancelled free of charge until the trip starts.

5. Deliveries

A delivery can be cancelled free of charge until the goods are picked up. Once the goods have been picked up, the booking cannot be cancelled in the app. Contact us through Help & Support if you need to change or stop a delivery.

6. Waiting time

After the rider arrives, waiting is free for the time shown in the app. After that, waiting charges are added to the fare.

7. Repeated cancellations

Frequent cancellations, or bookings made without the intention to travel, may lead to restrictions on your account.`;
const refund = `This policy explains when AnZ Cabs refunds money, how to ask for a refund and where the money goes.

1. When we refund

• You were charged more than the correct fare, for example because of a wrong waiting time or a route the rider took without reason.
• You paid online but the trip did not take place.
• You paid twice for the same trip.
• Any other case where our review finds you were charged incorrectly.

2. Payments that are fixed automatically

If an online payment succeeds but the booking does not show as paid, our system checks the payment with the payment gateway and applies it to the booking automatically. If a booking was already paid and a second payment arrives, the extra amount is added to your AnZ Cabs wallet automatically.

3. How to ask for a refund

Contact us through Help & Support in the app within 7 days of the trip and include the booking ID and what went wrong.

4. Review

Our team checks the trip details, route, fare breakdown and payment records. We may approve a full or partial refund, or decline the request and tell you why. We aim to decide within 7 working days.

5. Where the refund goes

• Paid by UPI, card or netbanking: the refund goes back to the original payment method through our payment partner. It usually takes 5–7 working days to appear, depending on your bank.
• Paid by cash or AnZ Cabs wallet: the refund is added to your AnZ Cabs wallet as soon as it is processed.

You get a notification in the app when your refund is processed.

6. What is not refunded

• Fares and charges for trips completed as booked.
• Tips, which go in full to the rider.
• Wallet balance cannot be refunded to a bank account. It stays available for use on AnZ Cabs.

7. Contact

For refund questions, contact us through Help & Support in the app or on our Contact Us page.`;
const riderTerms = `These Rider Terms & Conditions ("Rider Terms") apply to everyone who uses the AnZ Cabs rider app to provide rides or deliveries ("rider", "you"). By signing up you agree to these Rider Terms and our Rider Privacy Policy.

1. Your relationship with AnZ Cabs

You are an independent service provider, not an employee or agent of AnZ Cabs. You choose when to go online and which requests to accept. AnZ Cabs provides the app that connects you with customers, collects online payments and pays out your earnings.

2. Who can join

• You must be at least 18 years old and hold a valid driving licence for your vehicle class.
• You must provide your driving licence (front and back) and an Aadhaar or PAN card.
• Your vehicle must have a valid registration certificate, insurance and pollution certificate, and a permit where the law requires one.
• You need a smartphone that can run the rider app with location turned on.

3. Verification

• Our team reviews your documents and vehicle before you can take trips. We may reject or ask for more documents.
• Keep your documents valid. When insurance, the pollution certificate or a permit expires, upload the renewed one.
• You must take a selfie at regular intervals to go online. The selfie confirms that you are the verified rider.
• Only you may use your account. Letting someone else ride on your account leads to permanent removal.

4. Going online and accepting requests

• Requests are offered to the nearest available riders first. Each request shows the pickup, drop and your earning, and must be accepted within the time shown.
• You may decline requests. Frequent cancellations after accepting affect your standing and can lead to suspension.
• Go offline when you cannot take trips.

5. During a trip

• Go to the pickup point shown in the app and mark yourself arrived.
• Start a ride only after the customer gives you the correct OTP.
• Drive safely, follow traffic laws and keep your vehicle clean and in good condition. On bikes, wear a helmet and provide one for your passenger where the law requires it.
• Do not drive under the influence of alcohol or drugs, and do not smoke during a trip.
• Treat customers with respect. Harassment, abuse, discrimination or demanding extra money is not allowed.

6. Customer contact details

During an active trip the app shows the customer's mobile number so you can call them about the pickup or delivery. Use it only for that trip. Do not save, share or use a customer's number after the trip, or contact customers outside the app for any other reason. Misuse of customer data leads to removal from the platform and may be reported to the authorities.

7. Deliveries

• Photograph the goods at pickup as the app asks.
• Complete each drop only with the receiver's OTP and a proof-of-delivery photo.
• Do not open packages. Refuse goods that are illegal, prohibited, unsafe or badly packed, and tell us through the app.

8. Fares, commission and earnings

• The fare for every trip is calculated by the app. Do not ask customers for extra money.
• AnZ Cabs charges a commission on each trip, depending on the vehicle type and city. Your earning for a trip is shown before you accept and after you complete it.
• For trips paid online or by wallet, your earning is added to your AnZ Cabs rider wallet.
• Tips customers add go to you in full.

9. Cash trips and dues

• On cash trips you collect the full fare from the customer and confirm it in the app.
• The AnZ Cabs commission on a cash trip is added to your dues, shown as a negative wallet balance. Earnings from online trips reduce your dues.
• When your dues go above the limit shown in the app, you are taken offline and cannot go online until you pay your dues. You can pay dues from the app at any time.

10. Payouts

• You can request a payout of your wallet balance to your bank account or UPI ID. The minimum payout amount is shown in the app.
• The amount is held from your wallet while the payout is processed. If a payout is rejected, the amount returns to your wallet.
• One payout can be in progress at a time. Make sure your bank or UPI details are correct; we are not responsible for payouts sent to details you entered incorrectly.

11. Taxes

You are responsible for your own income tax and any other taxes on your earnings, and for keeping your own records. We may deduct taxes at source where the law requires and give you the related statements.

12. Insurance and liability

Keep valid insurance for your vehicle as required by law. You are responsible for loss, damage or injury caused by your negligence, traffic violations or breach of these Rider Terms.

13. Ratings and quality

Customers rate you after each trip. Consistently low ratings, complaints or safety concerns may lead to a review, a warning or suspension.

14. Suspension and removal

We may suspend or remove your account for unsafe driving, fraud, misuse of customer data, fake documents, unpaid dues, abuse or any breach of these Rider Terms. Where possible we tell you the reason, and you can ask us to review the decision.

15. Deleting your account

You can request account deletion from the rider app. It is completed after any dues are paid and payouts are settled. Some records are kept for the period required by law.

16. Changes, governing law and help

We may update these Rider Terms and will tell you in the app about important changes. These Rider Terms are governed by the laws of India. For help or grievances, contact us through Help & Support in the rider app or on our Contact Us page.`;
const about = `AnZ Cabs, Your Ride, Our Priority.

AnZ Cabs is a ride and delivery app based in Srinagar, Jammu & Kashmir. Customers book bikes, autos and cabs for their daily travel, and send parcels and goods across the city, all from one app.

1. What we offer

• Rides: Bike, Bike Lite, Auto, Cab Economy, Cab Premium and Rental Cars.
• Deliveries: bike porters for parcels and small goods vehicles, with up to 5 drops in one trip.
• Fares shown before you book, and payment by cash, UPI, card, netbanking or the AnZ Cabs wallet.

2. Safety first

Every rider's licence, vehicle papers and identity are checked before they can take trips. Each trip starts only with your Ride PIN, you can share your trip live with family, and the SOS button in the app reaches our team in one tap.

3. Earn with AnZ Cabs

Riders and transport partners use the AnZ Cabs rider app to take trips on their own schedule and see their earning before they accept.

4. Our office

AnZ Cabs
52, Afzal Complex, Court Road, Moominabad, Batamaloo
Srinagar, Jammu & Kashmir 190010

Phone: +91 70064 74093`;
const contact = `We are here to help with bookings, payments, safety concerns and anything else about AnZ Cabs.

1. Call us

Phone: +91 70064 74093

2. Visit or write to us

AnZ Cabs
52, Afzal Complex, Court Road, Moominabad, Batamaloo
Srinagar, Jammu & Kashmir 190010
India

3. Help in the app

For a question about a trip or a payment, open Help & Support in the AnZ Cabs app and choose the booking. Our team gets the trip details with your request, so we can help you faster.

4. Safety emergencies

During a trip, use the SOS button in the app. In an emergency, call 112.`;
exports.POLICIES = [
    { slug: 'terms', title: 'Terms & Conditions', content: terms },
    { slug: 'privacy', title: 'Privacy Policy', content: privacy },
    { slug: 'cancellation', title: 'Cancellation Policy', content: cancellation },
    { slug: 'refund', title: 'Refund Policy', content: refund },
    { slug: 'rider_terms', title: 'Rider Terms & Conditions', content: riderTerms },
    { slug: 'about', title: 'About Us', content: about },
    { slug: 'contact', title: 'Contact Us', content: contact },
];
//# sourceMappingURL=policies.js.map
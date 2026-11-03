# Openfront Travel Agent

Back office and client pages for an independent advisor or a small host agency that sells bespoke trips built from supplier components (hotels, cruises, tours, air, transfers, insurance) plus the agency's planning fee. It covers the inquiry-to-commission cycle: inquiry, proposal, accepted trip, supplier bookings, client payments, travel, and commission received.

Built on Next.js and KeystoneJS 6 (from next-keystone-starter) with a PostgreSQL database. Payments use Stripe in test mode by default.

## The Openfront Ecosystem

Every Openfront is open source and self-hostable.

| Product | For | Repository | Demo | Docs |
|---|---|---|---|---|
| Openfront E-commerce | Online store: catalog, checkout, orders, fulfillment | [openfront](https://github.com/openshiporg/openfront) | [e-commerce.openship.org](https://e-commerce.openship.org) | [Docs](https://docs.openship.org/docs/openfront/ecommerce) |
| Openfront Restaurant | Online ordering, POS and kitchen display | [openfront-restaurant](https://github.com/openshiporg/openfront-restaurant) | [restaurant.openship.org](https://restaurant.openship.org) | [Docs](https://docs.openship.org/docs/openfront/restaurant) |
| Openfront Grocery | Grocery ordering, lots, expiry and pickup | [openfront-grocery](https://github.com/openshiporg/openfront-grocery) | [grocery.openship.org](https://grocery.openship.org) | [Docs](https://docs.openship.org/docs/openfront/grocery) |
| Openfront Gym | Memberships, classes, check-in and billing | [openfront-gym](https://github.com/openshiporg/openfront-gym) | [gym.openship.org](https://gym.openship.org) | [Docs](https://docs.openship.org/docs/openfront/gym) |
| Openfront Hotel | Reservations, front desk, housekeeping, folios | [openfront-hotel](https://github.com/openshiporg/openfront-hotel) | [hotel.openship.org](https://hotel.openship.org) | [Docs](https://docs.openship.org/docs/openfront/hotel) |
| Openfront Rental | Short-term rental bookings and calendars | [openfront-rental](https://github.com/openshiporg/openfront-rental) | [rental.openship.org](https://rental.openship.org) | [Docs](https://docs.openship.org/docs/openfront/rental) |
| Openfront Salon | Appointments, stylists and services | [openfront-salon](https://github.com/openshiporg/openfront-salon) | [salon.openship.org](https://salon.openship.org) | [Docs](https://docs.openship.org/docs/openfront/salon) |
| Openfront Barbershop | Bookings, walk-ins and barbers | [openfront-barbershop](https://github.com/openshiporg/openfront-barbershop) | [barbershop.openship.org](https://barbershop.openship.org) | [Docs](https://docs.openship.org/docs/openfront/barbershop) |
| Openfront Coffee Shop | Café ordering and counter POS | [openfront-coffeeshop](https://github.com/openshiporg/openfront-coffeeshop) | [coffee-shop.openship.org](https://coffee-shop.openship.org) | [Docs](https://docs.openship.org/docs/openfront/coffee-shop) |
| Openfront Real Estate | Listings, showings and transactions | [openfront-realestate](https://github.com/openshiporg/openfront-realestate) | [real-estate.openship.org](https://real-estate.openship.org) | [Docs](https://docs.openship.org/docs/openfront/real-estate) |
| Openfront Dealership | Inventory, test drives, deals and service | [openfront-dealership](https://github.com/openshiporg/openfront-dealership) | [dealership.openship.org](https://dealership.openship.org) | [Docs](https://docs.openship.org/docs/openfront/dealership) |
| Openfront Vape | Age-gated retail with compliance controls | [openfront-vape](https://github.com/openshiporg/openfront-vape) | [vape.openship.org](https://vape.openship.org) | [Docs](https://docs.openship.org/docs/openfront/vape) |
| Openfront Convenience | Convenience store POS and inventory | [openfront-convenience](https://github.com/openshiporg/openfront-convenience) | [convenience.openship.org](https://convenience.openship.org) | [Docs](https://docs.openship.org/docs/openfront/convenience) |
| Openfront Collectibles | Graded items, consignment and provenance | [openfront-collectibles](https://github.com/openshiporg/openfront-collectibles) | [collectibles.openship.org](https://collectibles.openship.org) | [Docs](https://docs.openship.org/docs/openfront/collectibles) |
| Openfront Cannabis | Dispensary menu, packages and recalls | [openfront-cannabis](https://github.com/openshiporg/openfront-cannabis) | [cannabis.openship.org](https://cannabis.openship.org) | [Docs](https://docs.openship.org/docs/openfront/cannabis) |
| Openfront Pharmacy | Prescriptions, inventory lots and pickup | [openfront-pharmacy](https://github.com/openshiporg/openfront-pharmacy) | [pharmacy.openship.org](https://pharmacy.openship.org) | [Docs](https://docs.openship.org/docs/openfront/pharmacy) |
| Openfront Med Spa | Treatments, consents and memberships | [openfront-medspa](https://github.com/openshiporg/openfront-medspa) | [medspa.openship.org](https://medspa.openship.org) | [Docs](https://docs.openship.org/docs/openfront/medspa) |
| Openfront Construction | Projects, bids, change orders and crews | [openfront-construction](https://github.com/openshiporg/openfront-construction) | [construction.openship.org](https://construction.openship.org) | [Docs](https://docs.openship.org/docs/openfront/construction) |
| Openfront Law Firm | Matters, intake, time and billing | [openfront-law-firm](https://github.com/openshiporg/openfront-law-firm) | [law-firm.openship.org](https://law-firm.openship.org) | [Docs](https://docs.openship.org/docs/openfront/law-firm) |
| Openfront Scheduling | Booking pages for appointment businesses | [openfront-scheduling](https://github.com/openshiporg/openfront-scheduling) | [scheduling.openship.org](https://scheduling.openship.org) | [Docs](https://docs.openship.org/docs/openfront/scheduling) |
| Openfront Social | Creator community and posts | [openfront-social](https://github.com/openshiporg/openfront-social) | [social.openship.org](https://social.openship.org) | [Docs](https://docs.openship.org/docs/openfront/social) |
| Openfront Rideshare | Rides, drivers and dispatch | [openfront-rideshare](https://github.com/openshiporg/openfront-rideshare) | [rideshare.openship.org](https://rideshare.openship.org) | [Docs](https://docs.openship.org/docs/openfront/rideshare) |
| **Openfront Travel Agent** (this repository) | Trip proposals, supplier bookings, client payments and commission tracking | [openfront-travel-agent](https://github.com/openshiporg/openfront-travel-agent) | | |
| Openfront Airline | Flights, booking and passenger operations | [openfront-airline](https://github.com/openshiporg/openfront-airline) | [airline.openship.org](https://airline.openship.org) | [Docs](https://docs.openship.org/docs/openfront/airline) |
| Openfront Hospital | Appointments, patients and care teams | [openfront-hospital](https://github.com/openshiporg/openfront-hospital) | [hospital.openship.org](https://hospital.openship.org) | [Docs](https://docs.openship.org/docs/openfront/hospital) |
| Openfront Sportsbook | Markets, bets and results | [openfront-sportsbook](https://github.com/openshiporg/openfront-sportsbook) | [sportsbook.openship.org](https://sportsbook.openship.org) | [Docs](https://docs.openship.org/docs/openfront/sportsbook) |
| Openfront Financial | Accounts, portfolios and advisory | [openfront-financial](https://github.com/openshiporg/openfront-financial) | [financial.openship.org](https://financial.openship.org) | [Docs](https://docs.openship.org/docs/openfront/financial) |
| Openfront Analytics | Privacy-friendly website analytics | [analytics](https://github.com/openshiporg/analytics) | [analytics.openship.org](https://analytics.openship.org) | [Docs](https://docs.openship.org/docs/openfront/analytics) |
| Openship | Order routing from sales channels to fulfillment | [openship](https://github.com/openshiporg/openship) | [os.openship.org](https://os.openship.org) | [Docs](https://docs.openship.org/docs/openship/ecommerce) |
| Marketplace | Shop across Openfront stores | [marketplace](https://github.com/openshiporg/marketplace) | [marketplace.openship.org](https://marketplace.openship.org) | [Docs](https://docs.openship.org/docs/openfront/marketplace) |

## What is built

### Money
- **Two streams.** Client payments (the planning fee, plus deposits and finals for components the agency collects) and supplier commissions.
- **Integer minor units** everywhere, with an ISO currency code. Percentages are basis points. Expected commission is `floor(sell x bps / 10000)`, stored when a component is booked.
- **Client funds** are a per-trip ledger (`ClientFundsEntry`). The balance can never go below zero, a supplier payment cannot exceed the component's net cost, and a planning fee can only be moved to the agency from a paid planning invoice. Reversals link to the original entry.
- **Commission receipts** allocate to components. A receipt below the expected amount marks the component short-paid and opens a follow-up task. Over-payment is refused. The advisor and host-agency split is written to an append-only ledger.
- **Trips only reach paid in full, traveling or completed with a zero client balance.**

### Models
36 Keystone lists: Client, Traveler, Inquiry, Destination, Trip, Proposal, ProposalOption, ProposalItem, TripComponent, ItineraryDay, ItineraryItem, Supplier, SupplierContact, ClientInvoice, ClientInvoiceLine, PaymentSchedule, ClientFundsEntry, SupplierPayment, CommissionReceipt, CommissionAllocation, AdvisorCommissionLedger, Document, Task, AgencySettings, AuditEvent, IdempotencyKey, the payment set (PaymentProvider, PaymentCollection, PaymentSession, Payment, Refund, PaymentWebhookEvent), and User, Role, OAuthApp, OAuthToken.

Status fields are set only through custom mutations. Raw status updates are closed, financial and evidence lists are create-less through the API, and traveler date of birth, passport expiry and known traveler number cannot be read through the generic API.

### Operator mutations (GraphQL)
`createTripFromInquiry`, `buildProposal`, `sendProposal`, `bookComponent`, `generatePaymentSchedule`, `issueClientInvoice`, `recordClientPayment`, `recordSupplierPayment`, `recordCommissionReceipt`, `postClientFundsEntry`, `reverseEntry`, `cancelComponent`, `transitionTrip`, `sweepTripDates`, `shareItinerary`. Each takes an idempotency key, runs in a transaction under an advisory lock, and writes an audit event.

### Public operations (GraphQL)
`submitInquiry`, `viewProposal`, `acceptProposal`, `viewItinerary`, `viewInvoice`, `payInvoice`, `confirmInvoicePayment`, `publicDestinations`, `publicDestination`, `lookupBooking`. Proposal, itinerary and invoice links carry a random token stored only as a SHA-256 hash. Booking lookup needs the email on file and the trip or invoice code.

### Dashboard slices (`/dashboard/platform/...`)
Dashboard, Inquiries, Trips (with a workspace: overview, travelers, proposals, components, itinerary, payments, client funds, commissions, documents, tasks), Commissions (expected, invoiced, received, short-paid and written-off boards, receipts, advisor payouts), Clients and travelers, Suppliers, Invoices, Tasks, Payment Providers, Settings. Onboarding in the sidebar seeds a full agency (3 advisors, 15 suppliers, 20 clients, 6 inquiries, 9 trips) or a minimal one.

### Storefront (plain pages)
Destinations, an inquiry form, the tokenised proposal page (choose an option and accept with a name), the itinerary page, and the invoice page with card payment and a confirmation code. A booking lookup finds a trip by email and code.

### MCP
The MCP transport at `/api/mcp-transport/mcp` runs as the signed-in user (cookie or MCP OAuth token). Besides the generic schema tools, `travelOperation` calls the operator mutations above, so the same rules, audit and idempotency apply.

### Not included
Live air booking (GDS), supplier APIs, card authorisation forms, accounting sync, e-signature (acceptance records a name and timestamp), refunds over a threshold (refused until manager approval is added), commission over-payment approval.

## Getting started

Requirements: Node 20+, PostgreSQL.

```bash
npm install
# create .env with the values below
npm run dev
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | 32+ random characters |
| `PUBLIC_SIGNUPS_ALLOWED` | `false` for an agency back office |
| `NEXT_PUBLIC_STRIPE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe keys (test keys start `pk_test_` / `sk_test_`) |

`npm run dev` builds the Keystone schema, applies migrations and starts Next.js. Open `/dashboard/init` to create the first admin, then use the sidebar setup card to load the agency data.

```bash
npm run migrate:gen   # create a migration after changing models
npm run test:security
node --import tsx --test features/keystone/lib/travel-money.test.ts
```

## Project structure

```text
features/keystone/models/      Keystone lists
features/keystone/mutations/   operator and public GraphQL operations
features/keystone/lib/         money math (travel-money.ts) with tests
features/platform/             dashboard slices, navigation, onboarding
features/storefront/           public pages and actions
features/integrations/payment/ Stripe and manual adapters
app/dashboard/(admin)/platform thin route wrappers
app/(storefront)/              public routes
```


# NationX Testing Showcase

NationX uses several test layers so a successful demo proves more than a page opening.

## Judge-ready command

```bash
npm run test:judge
```

This runs the complete React component suite and the visual-quality browser suite. Playwright also writes an interactive HTML report to `playwright-report/index.html`.

To reopen the report:

```bash
npm run test:judge:report
```

## What the visual suite demonstrates

- All citizen routes render at desktop and phone widths without browser errors, broken images, or horizontal overflow.
- NID, passport, health, and education use distinct, valid ministry-specific village backgrounds.
- Stipend cards show each deadline once and keep their action inside the card.
- The assistant launcher stays compact, accessible, and usable on desktop and mobile.
- Mobile ministry navigation works from the keyboard and closes after selection.
- Form controls meet a 44-pixel touch target and remain inside the viewport.
- Reduced-motion users retain the complete page without decorative animation.

## Full project test layers

| Layer | Command | Evidence |
|---|---|---|
| React components and contracts | `npm run client:test` | Forms, loading/error states, XSS-safe rendering, duplicate-submit locks, API payloads |
| Visual browser quality | `npm run test:visual` | Responsive layout, imagery, navigation, accessibility, runtime health |
| Full browser journeys | `npm run test:browser` | Citizen/admin login, service navigation, Todo lifecycle, payments, assistant, medicine scanning |
| REST API and MySQL regression | `npm test` | Authentication, ownership isolation, procedures, triggers, transactions, admin scope |
| Assistant services | `npm run assistant:test` | Bengali speech, privacy redaction, provider validation and failover |
| Medicine pipeline | `npm run medicine:test` | Catalogue normalization, pricing safety and generated-data validation |

The test database must be installed and seeded before running the database-backed and full browser suites. The visual-quality suite uses synthetic browser fixtures and never modifies citizen data.

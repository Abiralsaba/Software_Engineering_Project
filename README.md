<div align="center">

# 🇧🇩 NationX

### Bangladesh, Connected.

A citizen-services interface inspired by the people, places, and possibilities of Bangladesh.

![HTML5](https://img.shields.io/badge/HTML5-Page_structure-B86545?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-Visual_foundation-267C78?style=flat-square&logo=css&logoColor=white)
![Project stage](https://img.shields.io/badge/Stage-Initial_frontend_structure-103D32?style=flat-square)

[Overview](#overview) · [Page directory](#page-directory) · [Project structure](#project-structure) · [Preview](#preview) · [Scope](#scope-and-limitations)

</div>

---

## Overview

NationX is an academic software-engineering project exploring a connected citizen-services experience. Its interfaces bring together identity, health, education, land, community, and administrative services in one visual system.

This initial commit contains **29 HTML pages and 23 CSS stylesheets**. It establishes the public page structure and styling—not a complete, independently runnable application.

> **Academic prototype:** NationX is not an official government service, and this repository snapshot is not ready for public deployment.

## Page directory

| Area | Interfaces |
| :--- | :--- |
| **Account access** | [Sign in](public/index.html), [registration](public/register.html), [password recovery](public/forgot-password.html) |
| **Citizen workspace** | [Dashboard](public/dashboard.html), [profile](public/profile.html), [documents](public/documents.html), [history](public/history.html), [to-do](public/todo.html) |
| **Identity & travel** | [NID](public/nid.html), [passport](public/passport.html) |
| **Everyday services** | [Health](public/health.html), [water](public/water.html), [tax](public/tax.html), [land](public/land.html), [agriculture](public/agriculture.html) |
| **Education & opportunity** | [Education](public/education.html), [admissions](public/admission.html), [application](public/apply.html) |
| **Community & support** | [Community](public/community.html), [events](public/events.html), [market](public/market.html), [shop](public/shop.html), [contact](public/contact.html) |
| **Administration** | [Admin sign in](public/admin-login.html), [NID](public/admin-nid.html), [passport](public/admin-passport.html), [health](public/admin-health.html), [water](public/admin-water.html), [reports](public/reports.html) |

## Visual foundation

- **Bangladesh-inspired identity** — green and red accents across the existing public interfaces.
- **Shared styling** — common authentication, sidebar, and citizen-page styles.
- **Domain-specific layouts** — individual stylesheets for service forms, dashboards, records, and administration.
- **Clear separation** — page markup in `public/`; stylesheets in `public/css/`.

## Project structure

```text
Software_Engineering_Project/
├── README.md
└── public/
    ├── index.html
    ├── register.html
    ├── dashboard.html
    ├── ...                      # 29 HTML pages in total
    └── css/
        ├── style.css
        ├── auth.css
        ├── sidebar.css
        ├── citizen-pages.css
        └── ...                  # 23 shared and page-specific stylesheets
```

## Preview

To inspect the markup and styles with **Python 3** installed, run this command from the repository root:

```bash
python3 -m http.server 8000 --directory public
```

Open **http://localhost:8000/index.html**. Press **Ctrl+C** to stop the preview.

This is a static preview only. Missing images, external assets, script errors, and failed API requests are possible because the corresponding files and backend are intentionally outside this commit. It cannot verify login, submissions, payments, or other application workflows.

## Scope and limitations

| Included in this commit | Intentionally not included |
| :--- | :--- |
| Public HTML pages | Separate JavaScript files and the React client |
| Shared and page-specific CSS | Images and uploaded files |
| This project overview | Backend, database scripts, and package setup |
| Existing markup preserved as-is | Credentials, private datasets, logs, and generated output |

Some existing HTML pages contain inline JavaScript; their contents have been preserved. Including an HTML file does **not** mean its interactive behavior works without the rest of the application.

Further components will be added in separately reviewed commits. No working payment integration, security guarantee, or production readiness is claimed by this initial structure.

---

<div align="center">

**Rooted in Bangladesh. Connected by possibility.**

<sub>NationX · Academic software-engineering project</sub>

</div>

# CivicFault — Product description

**CivicFault** is a community infrastructure fault tracker for neighborhoods, estates, and local authorities.

Residents report issues with a photo and GPS (potholes, water leaks, blocked drains, downed lines, uncollected waste, broken streetlights). The system classifies the issue, clusters nearby duplicates, and publishes a public transparency board. Estates and utilities run a paid **Authority console** to triage status, pin urgent items, meet SLAs, and export data.

**Tagline:** *Snap it. Pin it. Fix it — in the open.*

**Who it’s for**
- Residents (free): report, track *my reports*, discuss, confirm others’ reports
- Estate managers / utilities (paid): workspace, SLA, staff invites, digests, CSV
- Platform admin: moderate public feed, grant pilot plans

**What it is not**
- Not an ambulance, police, or clinical dispatch system
- Not a general social network

---

## Keeping reports genuine (anti-spam)

| Layer | Mechanism |
|-------|-----------|
| **Required photo + GPS** | Raises cost of mass spam |
| **Rate limits** | 20 reports / minute / IP; comment limits |
| **Duplicate clustering** | Nearby same-category reports share a cluster |
| **Community upvotes** | “I see this too” confirms reality |
| **Staff soft-delete** | Reject & hide junk without erasing audit for admin |
| **Resident accounts** | Repeat abusers can be suspended |
| **Optional later** | Phone OTP, hCaptcha on submit, min account age for public list |

Trust model: **transparency + friction on abuse**, not heavy KYC for every report.

---

## Emergency services

CivicFault does **not** replace 999 / local emergency numbers.

If a future “security alert” channel is added for estates:
1. Full-screen: **Call emergency services first**
2. App only notifies estate security *after* that acknowledgment
3. No medical diagnosis, no ambulance routing inside CivicFault

Infrastructure hazards after incidents (debris, damaged barriers) remain valid CivicFault reports.

---

## Roadmap (practical)

| Phase | Scope |
|-------|--------|
| **Now** | Resident auth · My reports · Status visible on my reports |
| **Next** | Follow workspace · Saved places · Luganda |
| **Later** | Estate security alert (not medical) · stronger OTP |

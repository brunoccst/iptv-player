# Legal notes (Germany)

> **Not legal advice.** This is a summary of German law as of September 2026 for people who use or run this app. For a binding answer about your own situation, ask a lawyer (Rechtsanwalt for copyright / IT law).

This app is a **player**. It ships no TV channels, films, series, channel lists or provider accounts. You connect it to an IPTV provider you choose. Whether using it is legal depends almost entirely on **that provider and what you do with the streams**.

## At a glance

| What you do | Legal in Germany? |
|-------------|-------------------|
| Install and use the app itself | Yes. A player without content is legal software, like VLC. |
| Watch a provider that holds the rights (licensed, paid service) | Yes, within the provider's terms (e.g. number of devices, one household). |
| Watch a provider that is **obviously unlawful** (see below) | **No.** Copyright infringement, even if you only stream and never download. |
| Download titles for offline viewing from a **lawful** provider | Usually yes, as a private copy (§ 53 UrhG), if the provider's terms allow it. Only for yourself; never pass files or devices on. |
| Download from an **obviously unlawful** provider | **No.** Private copies from obviously unlawful sources are not allowed (§ 53 (1) UrhG). |
| Let people **outside your household and close personal circle** watch through your server, relay or account | **No.** That is making works available to the public (§§ 15 (3), 19a UrhG, retransmission §§ 20, 20b UrhG) and almost always breaks the provider's terms. |
| Sell or give away devices with this app **plus** access to unlawful streams | **No.** The EU Court of Justice treats this as communication to the public (C-527/15 "Filmspeler", 2017). |

## Streaming from unlawful sources

- Watching a stream creates temporary copies in memory. § 44a UrhG allows such copies only for a **lawful use**. The EU Court of Justice ruled on 26 April 2017 (C-527/15, "Filmspeler") that streaming from a source the viewer knows or should know is unlawful is **not** covered. So "I only streamed, I didn't download" is no defence.
- Typical signs of an unlawful offer:
  - thousands of channels, including premium sports and pay TV from many countries, plus the newest cinema films, for a few euros a month;
  - sold through resellers, Telegram or marketplaces;
  - paid with gift cards or crypto;
  - no Impressum and no company you can identify.
- Lawful offers come from broadcasters, network operators and established streaming companies. They name the company behind them (Impressum) and have clear terms.

## Possible consequences of infringement

- **Civil claims** by rights holders (§ 97 UrhG): stop and desist, damages, and a formal warning letter (Abmahnung, § 97a UrhG). For a first infringement by a private person, the lawyer fees for the warning are capped: they are calculated on a value of € 1,000 (§ 97a (3) UrhG). Damages come on top.
- **Criminal law:** unlawful copying is punishable by up to 3 years in prison or a fine; attempt is also punishable (§ 106 UrhG). It is usually prosecuted only on complaint, unless there is a special public interest (§ 109 UrhG). Commercial infringement, such as reselling access, carries up to 5 years (§ 108a UrhG).
- **How people get identified:** streaming uploads nothing, unlike file sharing, so it is harder to detect. However, investigators who shut down illegal services can seize their customer and payment data.

## Copy protection

- Circumventing effective copy protection is not allowed (§ 95a UrhG). This app does **not** break DRM. Xtream-type providers send streams without DRM, and the app plays only what your account can already access.
- The TV app sends a common player name (User-Agent, default `VLC/3.0.21`), because many providers answer only known players. This is not copy protection and unlocks nothing your account does not pay for. You can change it with `APP_PROVIDER_USER_AGENT`.
- The app protects its own downloads (D-050):
  - they are encrypted and never saved as normal video files;
  - they are deleted when you sign out;
  - they stop playing when the subscription expires or the app has not been online for 30 days.
  
  These measures support the private-copy rules. They are not a guarantee (see KI-002, KI-038).

## Sharing with other people

The apps have no server and relay nothing: each device talks to the provider itself. Passing streams on to people
outside your household (for example by sharing your account or re-streaming) is covered in the table above.

- **Rights:** passing TV channels on to other people needs licences from the broadcasters and rights holders (§§ 20, 20b UrhG). A private IPTV subscription does not include these rights.
- **Data protection (DSGVO / GDPR):**
  - The apps store provider logins, profiles, watch progress and diagnostic logs on your own devices only. For purely personal or household use, the GDPR does not apply (Art. 2 (2) (c)).
  - Provider passwords are encrypted: in the Android Keystore on TV and phone, by the operating system in the desktop app.
- **Storage on devices (§ 25 TDDDG):** the apps store data on the device only where the function needs it (session, downloads, settings). They have no tracking or analytics, so no consent banner is needed for that.
- **Youth protection (JMStV):**
  - Offering adult content to the public requires age verification.
  - A "Kids" profile only shows categories whose names mark them as children's content (e.g. "Kids", "Kinder", "Cartoons"), because providers send no age ratings (D-053). This depends on how the provider names its categories, and it does not know the age of individual titles. An optional parental PIN can lock leaving a Kids profile and managing profiles (D-054). It is not an approved youth protection system.

## Other points

- **Broadcasting fee (Rundfunkbeitrag):** unchanged. It is due per household, whatever devices or apps you use.
- **Provider terms:** even with a lawful provider, sharing your account, exceeding the allowed number of streams, or relaying to other homes usually breaks the contract. The provider can then close the account.
- **Licence of this repository:**
  - [MIT No Attribution](../LICENSE) (`MIT-0`). Anyone may use, copy, change, publish, sell and redistribute the code, without having to credit the author.
  - The software comes "as is", without any warranty, and the authors are not liable for any claim or damage arising from its use (see [LICENSE](../LICENSE)).
  - Third-party libraries keep their own licences (mostly MIT, BSD and Apache 2.0). Distributing an APK should include their licence notices.
- **Responsibility for use:**
  - The authors provide a player only. They do not provide, host, select or link to any content, provider or channel list.
  - They have no control over how the code or apps built from it are used.
  - Whoever uses, runs, modifies or distributes this software is solely responsible for complying with the law, including copyright, and with their provider's terms.
  - Using this software to watch, download or share content without the rights holder's permission is not intended or endorsed.
- **Names:** "Xtream Codes" is used only to describe the provider API this app speaks. The app is not affiliated with any provider.

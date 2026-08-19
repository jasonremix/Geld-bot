/** Redaktionelle Inhalte der Landingpage. */

export const BENEFITS = [
  {
    title: "Sofortiger Zugang",
    body: "Zahlung bestätigt, Zugang freigeschaltet. Kein Warten, kein manueller Schritt – der komplette Ablauf läuft automatisiert.",
  },
  {
    title: "Kuratiert statt Masse",
    body: "Jedes Pack wird auf Klangqualität, Nutzbarkeit und Aktualität geprüft, bevor es in die Library geht.",
  },
  {
    title: "Klare Lizenzen",
    body: "Ab Pro ist die kommerzielle Nutzung inbegriffen. Ultimate liefert die vollständige kommerzielle Lizenz.",
  },
  {
    title: "Alle Formate",
    body: "WAV, MP3, MIDI, Presets, Projekt-Templates und PDFs – direkt einsetzbar in deiner DAW.",
  },
  {
    title: "Monatlich neu",
    body: "Neue Inhalte in festem Rhythmus. Pro und Ultimate erhalten zusätzliche wöchentliche Drops.",
  },
  {
    title: "Jederzeit kündbar",
    body: "Monatlich kündbar im Kundenbereich. Keine Mindestlaufzeit, keine versteckten Bedingungen.",
  },
] as const;

export const CONTENT_CATEGORIES = [
  { label: "Sample Packs", detail: "Drums, Loops, One-Shots, Vocal Chops" },
  { label: "Preset Packs", detail: "Serum, Vital, Massive, Sylenth" },
  { label: "Projekt-Templates", detail: "Ableton, FL Studio, Logic" },
  { label: "MIDI Packs", detail: "Chords, Melodien, Basslines" },
  { label: "Creator Assets", detail: "Cover-Vorlagen, Reels-Bausteine" },
  { label: "Guides", detail: "Mixing, Mastering, Release-Strategie" },
] as const;

export const CREATOR_AUDIENCE = [
  "Musiker",
  "DJs",
  "Produzenten",
  "Sänger",
  "Songwriter",
  "TikTok Creator",
  "YouTube Creator",
  "Instagram Creator",
  "Kleine Labels",
  "Content Creator",
] as const;

export const FAQ = [
  {
    q: "Wann bekomme ich Zugriff auf die Inhalte?",
    a: "Direkt nach der vom Zahlungsanbieter bestätigten Zahlung. Die Freischaltung erfolgt serverseitig über einen verifizierten Webhook – nicht über die Erfolgsseite im Browser.",
  },
  {
    q: "Kann ich jederzeit kündigen?",
    a: "Ja. Die Kündigung ist jederzeit im Kundenbereich möglich und wirkt zum Ende der laufenden Abrechnungsperiode.",
  },
  {
    q: "Darf ich die Inhalte kommerziell nutzen?",
    a: "Ab dem Plan Pro ist die kommerzielle Nutzung enthalten. Ultimate enthält zusätzlich die erweiterte kommerzielle Lizenz. Die genauen Bedingungen stehen in den AGB.",
  },
  {
    q: "Welche Formate bekomme ich?",
    a: "WAV, MP3, MIDI, Preset-Dateien, Projekt-Templates und PDFs. Downloads laufen über signierte, zeitlich begrenzte Links.",
  },
  {
    q: "Kann ich meinen Plan wechseln?",
    a: "Ja. Upgrade und Downgrade sind im Kundenbereich möglich; die Umstellung wird über den Zahlungsanbieter abgerechnet.",
  },
  {
    q: "Wie werden meine Zahlungsdaten verarbeitet?",
    a: "Die Zahlung läuft vollständig beim zertifizierten Zahlungsanbieter. Diese Plattform speichert keine Kartendaten und keine Bankverbindungen.",
  },
] as const;

/**
 * Kundenstimmen.
 *
 * WICHTIG: Hier werden ausschliesslich echte, ausdrücklich freigegebene Zitate
 * eingetragen. Es werden bewusst KEINE Beispiel-Testimonials ausgeliefert –
 * erfundene Bewertungen sind unzulässig.
 */
export type Testimonial = { quote: string; author: string; role: string };
export const TESTIMONIALS: Testimonial[] = [];

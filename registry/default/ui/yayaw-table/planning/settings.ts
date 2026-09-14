/** Shared presentation labels keep React and Vue planning settings equivalent. */
export function ganttSettingsLabels(locale = "en") {
  const french = locale.startsWith("fr");
  return {
    title: french ? "Réglages du Gantt" : "Gantt settings",
    zoom: "Zoom",
    weekStart: french ? "Premier jour de la semaine" : "First day of week",
    showDependencies: french ? "Afficher les dépendances" : "Show dependencies",
    zoomOptions: [
      { value: "day", label: french ? "Jour" : "Day" },
      { value: "week", label: french ? "Semaine" : "Week" },
      { value: "month", label: french ? "Mois" : "Month" },
    ],
    weekOptions: Array.from({ length: 7 }, (_, day) => ({
      value: String(day),
      label: new Intl.DateTimeFormat(locale, {
        weekday: "long",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(2026, 0, 4 + day))),
    })),
  };
}

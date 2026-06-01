// Weather lookup via wttr.in (accepts city names and zip codes). Returns a
// normalized { current, forecast } shape, or null if the lookup fails.

export async function fetchWeather(location) {
  try {
    // Try wttr.in first (accepts city names and zip codes)
    const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
    if (res.ok) {
      const data = await res.json();
      const current = data.current_condition?.[0];
      const forecast = data.weather?.slice(0, 7) || [];
      return {
        current: {
          tempF: parseInt(current?.temp_F || "0"),
          desc: current?.weatherDesc?.[0]?.value || "",
          feelsLikeF: parseInt(current?.FeelsLikeF || "0"),
          humidity: current?.humidity || "",
        },
        forecast: forecast.map(d => ({
          date: d.date,
          maxF: parseInt(d.maxtempF || "0"),
          minF: parseInt(d.mintempF || "0"),
          desc: d.hourly?.[4]?.weatherDesc?.[0]?.value || "",
        })),
      };
    }
  } catch {
    /* network/lookup failure — fall through to null */
  }
  return null;
}

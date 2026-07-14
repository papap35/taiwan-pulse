// Approximate centroid coordinates for Taiwan's 22 counties/cities.
// Used to place county-level events (weather alerts, air quality, security
// bulletins) on the map when no precise lat/lng is available.
export const COUNTY_COORDS: Record<string, { lat: number; lng: number }> = {
  臺北市: { lat: 25.0478, lng: 121.5319 },
  台北市: { lat: 25.0478, lng: 121.5319 },
  新北市: { lat: 25.0169, lng: 121.4628 },
  桃園市: { lat: 24.9936, lng: 121.301 },
  臺中市: { lat: 24.1477, lng: 120.6736 },
  台中市: { lat: 24.1477, lng: 120.6736 },
  臺南市: { lat: 22.9999, lng: 120.2269 },
  台南市: { lat: 22.9999, lng: 120.2269 },
  高雄市: { lat: 22.6273, lng: 120.3014 },
  基隆市: { lat: 25.128, lng: 121.7392 },
  新竹市: { lat: 24.8138, lng: 120.9675 },
  新竹縣: { lat: 24.8387, lng: 121.0177 },
  苗栗縣: { lat: 24.5602, lng: 120.8214 },
  彰化縣: { lat: 24.0518, lng: 120.5161 },
  南投縣: { lat: 23.9609, lng: 120.9718 },
  雲林縣: { lat: 23.7092, lng: 120.4313 },
  嘉義市: { lat: 23.4801, lng: 120.4491 },
  嘉義縣: { lat: 23.4518, lng: 120.2555 },
  屏東縣: { lat: 22.5519, lng: 120.5487 },
  宜蘭縣: { lat: 24.7021, lng: 121.7377 },
  花蓮縣: { lat: 23.9872, lng: 121.6015 },
  臺東縣: { lat: 22.7972, lng: 121.1444 },
  台東縣: { lat: 22.7972, lng: 121.1444 },
  澎湖縣: { lat: 23.5711, lng: 119.5793 },
  金門縣: { lat: 24.4491, lng: 118.3767 },
  連江縣: { lat: 26.1608, lng: 119.9497 },
};

export function countyCentroid(name: string | undefined) {
  if (!name) return undefined;
  for (const key of Object.keys(COUNTY_COORDS)) {
    if (name.includes(key)) return COUNTY_COORDS[key];
  }
  return undefined;
}

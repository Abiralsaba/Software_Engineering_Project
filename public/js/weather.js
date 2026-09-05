/**
 * Weather & Forecast Logic for Agriculture Department
 * Sources:
 * - Recent History: NASA POWER API (https://power.larc.nasa.gov/)
 * - Forecast: Open-Meteo API (https://open-meteo.com/)
 */

const WeatherManager = {
    // Default to Dhaka, Bangladesh if geolocation fails
    defaultLocation: { lat: 23.8103, lon: 90.4125 },

    init: function () {
        this.renderPlaceholders();
        this.getLocation();
    },

    getLocation: function () {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.fetchData(position.coords.latitude, position.coords.longitude);
                },
                (error) => {
                    console.warn("Geolocation denied or failed, using default.", error);
                    this.fetchData(this.defaultLocation.lat, this.defaultLocation.lon);
                }
            );
        } else {
            console.warn("Geolocation not supported, using default.");
            this.fetchData(this.defaultLocation.lat, this.defaultLocation.lon);
        }
    },

    fetchData: function (lat, lon) {
        this.fetchForecast(lat, lon);
        // this.fetchNASAHistory(lat, lon); // Disabled as per user request
    },

    // ---------------------------------------------------------
    // 1. Forecast Data (Open-Meteo)
    // ---------------------------------------------------------
    fetchForecast: async function (lat, lon) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=6`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            this.renderForecast(data);
        } catch (error) {
            console.error("Forecast Error:", error);
            document.getElementById('weather-forecast-container').innerHTML = `<p class="error-text">Unable to load forecast.</p>`;
        }
    },

    renderForecast: function (data) {
        const container = document.getElementById('weather-forecast-container');
        if (!data || !data.daily) return;

        let html = '<div class="forecast-grid">';

        data.daily.time.forEach((dateStr, index) => {
            const date = new Date(dateStr);
            // Format Day Name
            const dayName = index === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });

            // Format Date (e.g., 24 Oct)
            const dayDate = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

            const maxTemp = Math.round(data.daily.temperature_2m_max[index]);
            const minTemp = Math.round(data.daily.temperature_2m_min[index]);
            const rainProb = data.daily.precipitation_probability_max[index];
            const rainSum = data.daily.precipitation_sum[index];

            // Determine Icon & Color
            let icon = 'fas fa-sun';
            let color = '#fbbf24'; // sunny yellow

            if (rainSum > 5) {
                icon = 'fas fa-cloud-showers-heavy';
                color = '#60a5fa'; // rain blue
            } else if (rainSum > 0.5) {
                icon = 'fas fa-cloud-rain';
                color = '#93c5fd'; // light rain
            } else if (maxTemp > 35) {
                icon = 'fas fa-fire-alt';
                color = '#ef4444'; // hot red
            } else if (maxTemp < 15) {
                icon = 'fas fa-snowflake';
                color = '#bfdbfe'; // cold blue
            } else if (index === 0 && rainSum < 0.5) {
                // Special icon for Today if sunny
                icon = 'fas fa-sun';
                color = '#f59e0b';
            }

            html += `
                <div class="forecast-card">
                    <div class="forecast-day">
                        ${dayName} <br>
                        <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 400;">${dayDate}</span>
                    </div>
                    <div class="forecast-icon" style="color: ${color}"><i class="${icon}"></i></div>
                    <div class="forecast-temp">
                        <span class="max">${maxTemp}°</span> <span class="min">${minTemp}°</span>
                    </div>
                    <div class="forecast-rain">
                        <i class="fas fa-umbrella"></i> ${rainProb}%
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    // ---------------------------------------------------------
    // 2. NASA POWER History Data
    // ---------------------------------------------------------
    fetchNASAHistory: async function (lat, lon) {
        // Calculate dates: Start = 10 days ago, End = 2 days ago (due to 2-3 day latency)
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - 3);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 10);

        const formatDate = (d) => d.toISOString().split('T')[0].replace(/-/g, '');
        const startStr = formatDate(startDate);
        const endStr = formatDate(endDate);

        // Parameters: T2M (Temp), PRECTOTCORR (Rain), RH2M (Humidity)
        const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR,RH2M&community=AG&longitude=${lon}&latitude=${lat}&start=${startStr}&end=${endStr}&format=JSON`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            this.renderNASAHistory(data);
        } catch (error) {
            console.error("NASA API Error:", error);
            document.getElementById('nasa-history-container').innerHTML = `<p class="error-text">Unable to load NASA data.</p>`;
        }
    },

    renderNASAHistory: function (data) {
        const container = document.getElementById('nasa-history-container');
        if (!data || !data.properties || !data.properties.parameter) return;

        const params = data.properties.parameter;
        const dates = Object.keys(params.T2M).sort(); // Get sorted dates

        // Calculate Averages/Totals for the period
        let totalRain = 0;
        let avgTemp = 0;
        let count = 0;

        dates.forEach(date => {
            const t = params.T2M[date];
            const r = params.PRECTOTCORR[date];
            if (t !== -999 && r !== -999) { // NASA uses -999 for missing data
                avgTemp += t;
                totalRain += r;
                count++;
            }
        });

        if (count > 0) avgTemp /= count;

        let html = `
            <div class="nasa-stats">
                <div class="nasa-stat-item">
                    <div class="label">Avg Temp (Last 7d)</div>
                    <div class="value">${avgTemp.toFixed(1)}°C</div>
                </div>
                <div class="nasa-stat-item">
                    <div class="label">Total Rainfall</div>
                    <div class="value">${totalRain.toFixed(1)} mm</div>
                </div>
                 <div class="nasa-source">
                    <i class="fas fa-satellite-dish"></i> Source: NASA POWER
                </div>
            </div>
            <div class="nasa-chart-placeholder">
                <!-- Simple CSS Bar Chart for Rainfall -->
                <div class="chart-title">Rainfall Trend (Last 7 Days)</div>
                <div class="bar-chart">
        `;

        // render last 7 available days
        const recentDates = dates.slice(-7);
        const maxRainInPeriod = Math.max(...recentDates.map(d => params.PRECTOTCORR[d]), 5); // Avoid div by zero

        recentDates.forEach(date => {
            const rain = params.PRECTOTCORR[date];
            const height = (rain / maxRainInPeriod) * 100; // Percentage height
            const dateDisplay = `${date.substring(6, 8)}/${date.substring(4, 6)}`; // DD/MM

            html += `
                <div class="bar-group">
                    <div class="bar" style="height: ${Math.max(height, 5)}%;" title="${rain.toFixed(1)} mm"></div>
                    <div class="bar-label">${dateDisplay}</div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    renderPlaceholders: function () {
        document.getElementById('weather-forecast-container').innerHTML = '<div class="loader">Loading Forecast...</div>';
        // document.getElementById('nasa-history-container').innerHTML = '<div class="loader">Fetching NASA Data...</div>';
    }
};

// Initialize after DOM load
document.addEventListener('DOMContentLoaded', () => {
    WeatherManager.init();
});

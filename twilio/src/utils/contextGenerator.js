export function generateVitalsContext(vitals, alertType) {
    const { heart_rate, spo2, stress_level } = vitals;
    let concerns = [];
    if (alertType === "high_alert") {
        if (heart_rate > 110 || heart_rate < 50) concerns.push(`HR=${heart_rate}`);
        if (spo2 < 93) concerns.push(`SpO2=${spo2}%`);
        if (stress_level > 60) concerns.push(`Stress=${stress_level}`);
    }
    return {
        concernText: concerns.join(" and ") || "vital sign changes",
        severity: alertType === "high_alert" ? "severe" : "moderate"
    };
}

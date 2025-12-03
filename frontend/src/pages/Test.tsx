
import React, { useState } from "react";
import axios from "axios";
import { Navigation } from "../components/ui/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";

export default function Test() {
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const sendSimulation = async (endpoint: string, body?: any) => {
    try {
      setLoading(true);
      setApiResponse("Sending...");

      const url = `https://neurobridge-simulator.onrender.com${endpoint}`;

      const res = await axios.post(url, body || {});
      setApiResponse(res.data || "Success");
    } catch (err: any) {
      console.log(err);
      setApiResponse(err.response?.data || "Error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="md:ml-64 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* HEADER */}
          <div>
            <h1 className="text-3xl font-bold">System Test & Debug Panel</h1>
            <p className="text-muted-foreground">
              Simulate high-risk conditions and override realtime vitals.
            </p>
          </div>

          {/* SIMULATION CONTROL */}
          <Card>
            <CardHeader>
              <CardTitle>Simulation Controls</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">
                Choose a scenario to simulate health events in realtime.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* HEART ATTACK */}
                <Button
                  variant="destructive"
                  disabled={loading}
                  onClick={() =>
                    sendSimulation("/override", {
                      heart_rate: 195,
                      spo2: 88,
                      stress_level: 10,
                    })
                  }
                >
                  ❤️ Heart Attack Simulation
                </Button>

                {/* RESET */}
                <Button
                  variant="secondary"
                  disabled={loading}
                  onClick={() => sendSimulation("/reset")}
                >
                  🔄 Reset to Normal
                </Button>

                {/* SMALL ALERT */}
                <Button
                  variant="outline"
                  disabled={loading}
                  onClick={() =>
                    sendSimulation("/override", {
                      heart_rate: 105,
                      spo2: 96,
                      stress_level: 5,
                    })
                  }
                >
                  ⚠️ Small Alert
                </Button>

                {/* HIGHLY STRESSED */}
                <Button
                  variant="default"
                  disabled={loading}
                  onClick={() =>
                    sendSimulation("/override", {
                      heart_rate: 80,
                      spo2: 97,
                      stress_level: 92,
                    })
                  }
                >
                  😰 Highly Stressed
                </Button>
              </div>

              {apiResponse && (
                <pre className="bg-muted p-4 rounded-xl text-sm whitespace-pre-wrap mt-4">
                  {JSON.stringify(apiResponse, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>

          {/* STATIC INFO */}
          <Card>
            <CardHeader>
              <CardTitle>Static System Checks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p>✔ Frontend Rendering — Working</p>
              <p>✔ Simulation API — Integrated</p>
              <p>✔ State Management — Working</p>
              <p>✔ UI Buttons — Working</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

























import React, { useEffect, useState } from "react";
import { Navigation } from "../components/ui/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Heart, Activity, Brain, Battery } from "lucide-react";
import { API } from "../api/api";

export default function HeartHealth() {
  const [data, setData] = useState<any>(null);

  const fetchRealtime = async () => {
    try {
      const res = await API.get("/realtime/latest");
      setData(res.data.data);
    } catch (err) {
      console.log("Realtime fetch error:", err);
    }
  };

  useEffect(() => {
    fetchRealtime();
  }, []);

  const heartRate = data?.heart_rate ?? 0;
  const spo2 = data?.spo2 ?? 0;
  const stress = data?.stress_level ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="md:ml-64 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* HEADER */}
          <div>
            <h1 className="text-3xl font-bold">Heart Health</h1>
            <p className="text-muted-foreground">
              Real-time cardiovascular insights
            </p>
          </div>

          {/* METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Heart Rate */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Heart Rate <Heart className="w-5 h-5 text-red-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{heartRate}</p>
                <p className="text-sm text-muted-foreground">beats per minute</p>
              </CardContent>
            </Card>

            {/* SpO2 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  SpO2 <Activity className="w-5 h-5 text-blue-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{spo2}%</p>
                <p className="text-sm text-muted-foreground">oxygen saturation</p>
              </CardContent>
            </Card>

            {/* Stress Level */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Stress Level <Brain className="w-5 h-5 text-purple-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{stress}</p>
                <p className="text-sm text-muted-foreground">current stress index</p>
              </CardContent>
            </Card>
          </div>

          {/* STATIC BLOOD PRESSURE */}
          <Card>
            <CardHeader>
              <CardTitle>Blood Pressure</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">120/80</p>
              <p className="text-sm text-muted-foreground">mmHg (static)</p>
            </CardContent>
          </Card>

          {/* STATUS */}
          <Card className="border-success bg-success/10">
            <CardContent className="py-4">
              <Badge className="bg-success text-white">Normal Status</Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Your cardiovascular readings are within normal range.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

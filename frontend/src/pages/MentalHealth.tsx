













import React, { useEffect, useState } from "react";
import { Navigation } from "../components/ui/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Brain, Moon, Battery, Flower } from "lucide-react";
import { API } from "../api/api";

export default function MentalHealth() {
  const [realtime, setRealtime] = useState<any>(null);
  const [daily, setDaily] = useState<any>(null);

  const fetchData = async () => {
    try {
      const [rRes, dRes] = await Promise.all([
        API.get("/realtime/latest"),
        API.get("/daily/latest"),
      ]);

      setRealtime(rRes.data.data);
      setDaily(dRes.data.data);
    } catch (err) {
      console.log("Mental health fetch error:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const stress = realtime?.stress_level ?? 0;
  const sleepQuality = daily?.sleep?.quality ?? "—";
  const energyScore = daily?.energy_score ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="md:ml-64 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">Mental Health</h1>
            <p className="text-muted-foreground">
              Track stress, sleep quality, and overall wellness
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Stress Level */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Stress Level <Brain className="w-5 h-5 text-purple-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{stress}</p>
                <p className="text-sm text-muted-foreground">current stress score</p>
              </CardContent>
            </Card>

            {/* Sleep Quality */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Sleep Quality <Moon className="w-5 h-5 text-blue-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{sleepQuality}</p>
                <p className="text-sm text-muted-foreground">
                  last night's sleep rating
                </p>
              </CardContent>
            </Card>

            {/* Energy Score */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Energy Score <Battery className="w-5 h-5 text-green-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{energyScore}</p>
                <p className="text-sm text-muted-foreground">current energy level</p>
              </CardContent>
            </Card>
          </div>

          {/* Mood (Static UI) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                Mood Indicator <Flower className="w-5 h-5 text-pink-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">🙂 Neutral</p>
              <p className="text-sm text-muted-foreground mt-2">
                Mood score is currently estimated from general activity patterns.
              </p>
            </CardContent>
          </Card>

          {/* Status */}
          <Card className="border-blue-400 bg-blue-50">
            <CardContent className="py-4">
              <Badge className="bg-blue-500 text-white">Mental Status: Stable</Badge>
              <p className="text-sm text-muted-foreground mt-3">
                Your mental health indicators show stable trends. Keep maintaining a
                balanced sleep and relaxation routine.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

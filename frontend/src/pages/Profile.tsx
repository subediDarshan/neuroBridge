

import React, { useEffect, useState } from "react";
import { Navigation } from "../components/ui/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { API } from "../api/api";

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [personal, setPersonal] = useState<any>(null);

  const [isEditing, setIsEditing] = useState(false);


  
const fetchData = async () => {
  try {
    const userId = localStorage.getItem("userId");
    console.log("USER ID FROM LOCALSTORAGE =", userId);

    if (!userId) {
      console.log("❌ No userId found in localStorage");
      return;
    }

    const [userRes, personalRes] = await Promise.all([
      API.get("/user/me", { params: { userId } }),
      API.get("/personal/me", { params: { userId } }),
    ]);

    console.log("USER RESPONSE =", userRes.data);
    console.log("PERSONAL RESPONSE =", personalRes.data);

    setUser(userRes.data.data);
    setPersonal(personalRes.data.data);
  } catch (err: any) {
    console.log("❌ ERROR FETCHING PROFILE =", err.response?.data || err);
  }
};




  useEffect(() => {
    fetchData();
  }, []);

  // Controlled Inputs (editable only when isEditing = true)
  const handleChange = (section: string, field: string, value: any) => {
    if (section === "user") {
      setUser((prev: any) => ({ ...prev, [field]: value }));
    } else {
      setPersonal((prev: any) => ({ ...prev, [field]: value }));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="md:ml-64 p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Profile</h1>

            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)}>Edit</Button>
            ) : (
              <div className="flex gap-3">
                <Button onClick={() => setIsEditing(false)} variant="secondary">
                  Cancel
                </Button>
                <Button disabled>Save</Button>
              </div>
            )}
          </div>

          {/* USER INFO */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* NAME */}
              <div>
                <Label>Full Name</Label>
                <Input
                  className="rounded-xl"
                  value={user?.username ?? ""}
                  disabled={!isEditing}
                  onChange={(e) =>
                    handleChange("user", "username", e.target.value)
                  }
                />
              </div>

              {/* EMAIL */}
              <div>
                <Label>Email</Label>
                <Input
                  className="rounded-xl"
                  type="email"
                  value={user?.emailId ?? ""}
                  disabled
                />
              </div>

              {/* DOB */}
              <div>
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  className="rounded-xl"
                  value={
                    personal?.dob
                      ? new Date(personal.dob)
                          .toISOString()
                          .split("T")[0]
                      : ""
                  }
                  disabled={!isEditing}
                  onChange={(e) =>
                    handleChange("personal", "dob", e.target.value)
                  }
                />
              </div>

              {/* GENDER */}
              <div>
                <Label>Gender</Label>
                <Input
                  className="rounded-xl"
                  value={personal?.gender ?? ""}
                  disabled={!isEditing}
                  onChange={(e) =>
                    handleChange("personal", "gender", e.target.value)
                  }
                />
              </div>

              {/* ADDRESS */}
              <div>
                <Label>Address</Label>
                <Input
                  className="rounded-xl"
                  value={personal?.address ?? ""}
                  disabled={!isEditing}
                  onChange={(e) =>
                    handleChange("personal", "address", e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* MEDICAL DETAILS */}
          <Card>
            <CardHeader>
              <CardTitle>Medical Information</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* MEDICAL HISTORY */}
              <div>
                <Label>Medical History</Label>
                <Input
                  className="rounded-xl"
                  value={personal?.medicalHistory ?? ""}
                  disabled={!isEditing}
                  onChange={(e) =>
                    handleChange("personal", "medicalHistory", e.target.value)
                  }
                />
              </div>

              {/* FAMILY HISTORY */}
              <div>
                <Label>Family History</Label>
                <Input
                  className="rounded-xl"
                  value={personal?.familyHistory ?? ""}
                  disabled={!isEditing}
                  onChange={(e) =>
                    handleChange("personal", "familyHistory", e.target.value)
                  }
                />
              </div>

              {/* LIFESTYLE */}
              <div>
                <Label>Lifestyle</Label>
                <Input
                  className="rounded-xl"
                  value={personal?.lifestyle ?? ""}
                  disabled={!isEditing}
                  onChange={(e) =>
                    handleChange("personal", "lifestyle", e.target.value)
                  }
                />
              </div>

              {/* EMERGENCY CONTACT */}
              <div>
                <Label>Emergency Contact</Label>
                <Input
                  className="rounded-xl"
                  value={personal?.emergencyContact ?? ""}
                  disabled={!isEditing}
                  onChange={(e) =>
                    handleChange("personal", "emergencyContact", e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

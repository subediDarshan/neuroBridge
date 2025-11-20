import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Home, BarChart3, User, Menu, X, TestTube } from "lucide-react";
import { useLocation, Link } from "react-router-dom";

const navigationItems = [
  {
    name: "Home",
    href: "/",
    icon: Home,
  },
  {
    name: "Dashboard", 
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    name: "Test System",
    href: "/test",
    icon: TestTube,
    special: "emergency"
  },
  {
    name: "Profile",
    href: "/profile", 
    icon: User,
  },
];

export function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 right-4 z-50 md:hidden glass-effect"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X /> : <Menu />}
      </Button>

      {/* Navigation overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Navigation panel */}
      <nav
        className={cn(
          "fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-40 transform transition-transform duration-300 ease-in-out",
          "md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">N</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold">NeuroBridge</h1>
              <p className="text-xs text-muted-foreground">Bridging You to Wellness</p>
            </div>
          </div>

          <div className="space-y-2">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                    "hover:bg-primary/10 hover:text-primary",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-foreground/70",
                    item.special === "emergency" && !isActive
                      ? "bg-warning/10 text-warning border border-warning/20 animate-pulse"
                      : ""
                  )}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
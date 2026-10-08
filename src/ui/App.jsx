import React, { useState, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  ShieldCheck,
  Compass,
  Gauge,
  Bot,
  Radio,
  ChevronRight,
  Terminal,
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("capabilities");
  const [activeShape, setActiveShape] = useState("nebula");
  const [selectedCircuit, setSelectedCircuit] = useState("spa");
  const [selectedWeather, setSelectedWeather] = useState("dry");
  const [drsActive, setDrsActive] = useState(false);
  const [mcpClient, setMcpClient] = useState("claude");
  const [gpuInfo, setGpuInfo] = useState({
    tier: "Tier 2+",
    particles: 32000,
    fps: "60 FPS",
    renderer: "WebGL 2.0 (High Performance)",
  });

  // Read actual WebGL state if available on window.experience
  useEffect(() => {
    if (typeof window !== "undefined" && window.experience) {
      const exp = window.experience;
      setGpuInfo({
        tier: exp.quality?.tier ? `Tier ${exp.quality.tier}` : "Tier 2+",
        particles: exp.quality?.particles || 32000,
        fps: "60 FPS (Adaptive)",
        renderer: exp.renderer?.instance?.capabilities?.isWebGL2
          ? "WebGL 2.0 (Accelerated)"
          : "WebGL 1.0",
      });
    }
  }, []);

  const trigger3DShape = (shapeKey) => {
    setActiveShape(shapeKey);
    if (
      typeof window !== "undefined" &&
      window.experience &&
      window.experience.world
    ) {
      window.experience.world.setState(shapeKey, 1.6);
      window.experience.invalidate(3);
    }
  };

  const CIRCUITS = {
    spa: {
      name: "Spa-Francorchamps",
      length: "7.004 km",
      turns: 19,
      elevation: "102.2 m",
      highlight: "Eau Rouge / Raidillon 17% compression",
    },
    silverstone: {
      name: "Silverstone Grand Prix",
      length: "5.891 km",
      turns: 18,
      elevation: "11.3 m",
      highlight: "Maggotts-Becketts lateral 4.8G sweep",
    },
    madrid: {
      name: "Madrid Street Circuit",
      length: "5.474 km",
      turns: 20,
      elevation: "26.8 m",
      highlight: "High-deceleration urban asphalt curbs",
    },
    zolder: {
      name: "Circuit Zolder",
      length: "4.011 km",
      turns: 10,
      elevation: "15.0 m",
      highlight: "Sacraments chicane curb jump dynamics",
    },
  };

  const WEATHERS = {
    dry: { label: "Dry Standard", grip: "100%", temp: "28°C Track", aero: "1.00" },
    wet: { label: "Dynamic Rain", grip: "78%", temp: "19°C Wet", aero: "0.92" },
    snow: { label: "Sub-Zero Snow", grip: "42%", temp: "-2°C Ice", aero: "0.85" },
    night: { label: "Volumetric Night", grip: "96%", temp: "16°C Cold", aero: "1.04" },
  };

  return (
    <div className="max-w-4xl mx-auto py-16 px-4 md:px-6">
      {/* Studio Systems Control Deck */}
      <Card className="bg-[#0a0a0f] border-[rgba(197,196,194,0.14)] mb-10 shadow-[0_30px_100px_-30px_rgba(0,0,0,0.95)] overflow-hidden">
        <CardHeader className="border-b border-[rgba(197,196,194,0.08)] bg-[#07070b]/60 pb-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#ff5500] animate-pulse"></span>
                <span className="font-mono text-[#ff5500] uppercase tracking-widest text-xs font-semibold">
                  Studio Systems Deck · Live Core
                </span>
              </div>
              <CardTitle className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Zeriotic Interactive Architecture
              </CardTitle>
              <CardDescription className="text-sm text-[#9f9e9a] mt-1">
                Explore our engineering disciplines, interactive 3D simulations, and flagship autonomous systems.
              </CardDescription>
            </div>

            {/* GPU Telemetry Pill */}
            <div className="font-mono text-[11px] bg-[#050508] border border-[rgba(197,196,194,0.12)] rounded-md px-3 py-2 flex flex-col gap-1 text-[#c5c4c2] self-start md:self-center">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#6f6e6c]">PIPELINE</span>
                <span className="text-[#ff9163] font-medium">{gpuInfo.renderer}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#6f6e6c]">HARDWARE</span>
                <span className="text-white font-medium">{gpuInfo.tier} · {gpuInfo.particles.toLocaleString()} PTS</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-[rgba(197,196,194,0.06)] font-mono text-xs">
            <button
              onClick={() => setActiveTab("capabilities")}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "capabilities"
                  ? "bg-[#ff5500] text-black font-semibold shadow-sm"
                  : "bg-[#050508] text-[#c5c4c2] hover:text-white border border-[rgba(197,196,194,0.1)]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Capabilities Matrix
            </button>
            <button
              onClick={() => setActiveTab("3d-engine")}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "3d-engine"
                  ? "bg-[#ff5500] text-black font-semibold shadow-sm"
                  : "bg-[#050508] text-[#c5c4c2] hover:text-white border border-[rgba(197,196,194,0.1)]"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" /> 3D WebGL Morph Deck
            </button>
            <button
              onClick={() => setActiveTab("accert-sim")}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "accert-sim"
                  ? "bg-[#ff5500] text-black font-semibold shadow-sm"
                  : "bg-[#050508] text-[#c5c4c2] hover:text-white border border-[rgba(197,196,194,0.1)]"
              }`}
            >
              <Gauge className="w-3.5 h-3.5" /> Accert One Sim
            </button>
            <button
              onClick={() => setActiveTab("octadezx-mcp")}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "octadezx-mcp"
                  ? "bg-[#ff5500] text-black font-semibold shadow-sm"
                  : "bg-[#050508] text-[#c5c4c2] hover:text-white border border-[rgba(197,196,194,0.1)]"
              }`}
            >
              <Bot className="w-3.5 h-3.5" /> OctaDezx Console
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 pb-6">
          {/* TAB 1: CAPABILITIES ACCORDION */}
          {activeTab === "capabilities" && (
            <div className="space-y-4">
              <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
                <AccordionItem value="item-1" className="border-[rgba(197,196,194,0.1)] py-1">
                  <AccordionTrigger className="text-white hover:text-[#ff5500] font-semibold text-base md:text-lg">
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#ff5500]" />
                      High-performance Web Apps & Digital Flagships
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-[#a5a4a0] text-sm leading-relaxed pl-6">
                    <p className="mb-2">
                      We engineer Next.js, Remix, and Vite applications that load in under 50ms TTFB, respecting user bandwidth and battery conservation.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2 font-mono text-[11px] text-[#ff9163]">
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">Zero-CLS Layouts</span>
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">Edge SSR & Streaming</span>
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">State Synchronization</span>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2" className="border-[rgba(197,196,194,0.1)] py-1">
                  <AccordionTrigger className="text-white hover:text-[#ff5500] font-semibold text-base md:text-lg">
                    <span className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[#ff5500]" />
                      E-commerce Platforms & Spatial Commerce
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-[#a5a4a0] text-sm leading-relaxed pl-6">
                    <p className="mb-2">
                      Custom headless checkouts, ERP orchestrations, and real-time 3D product configurators (thread-by-thread knitwear, luxury watch dials, and spatial vehicles) allowing visitors to inspect before purchase.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2 font-mono text-[11px] text-[#ff9163]">
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">Shopify Storefront API</span>
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">Server-Verified Carts</span>
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">Stripe Global Processing</span>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3" className="border-[rgba(197,196,194,0.1)] py-1">
                  <AccordionTrigger className="text-white hover:text-[#ff5500] font-semibold text-base md:text-lg">
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#ff5500]" />
                      Interactive 3D, WebGL & Spatial Simulation
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-[#a5a4a0] text-sm leading-relaxed pl-6">
                    <p className="mb-2">
                      Zero-latency particle architectures, dynamic resolution scaling, GLSL shaders, and responsive WebGL environments mapped seamlessly to user interaction. Integrating Three.js, Babylon.js, WebGL2, Cesium geospatial spatial layers, and Theatre.js motion curves.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2 font-mono text-[11px] text-[#ff9163]">
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">Hardware Quality Detection</span>
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">Disjoint Timer Queries</span>
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">Custom GLSL Morph Pipelines</span>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4" className="border-[rgba(197,196,194,0.1)] py-1">
                  <AccordionTrigger className="text-white hover:text-[#ff5500] font-semibold text-base md:text-lg">
                    <span className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-[#ff5500]" />
                      Autonomous Agent Platforms (OctaDezx Architecture)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-[#a5a4a0] text-sm leading-relaxed pl-6">
                    <p className="mb-2">
                      Full-duplex real-time telephony with conversational barge-in, computer-vision catalogue discovery, and Model Context Protocol (MCP) servers enabling seamless external AI execution with zero data-leak guarantees.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2 font-mono text-[11px] text-[#ff9163]">
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">Native MCP RFC-2024</span>
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">96 Platform Connectors</span>
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">Sub-300ms Audio Pipeline</span>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-5" className="border-[rgba(197,196,194,0.1)] border-b-0 py-1">
                  <AccordionTrigger className="text-white hover:text-[#ff5500] font-semibold text-base md:text-lg">
                    <span className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-[#ff5500]" />
                      Real-Time Physics & Gaming Simulation (Accert One Engine)
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-[#a5a4a0] text-sm leading-relaxed pl-6">
                    <p className="mb-2">
                      Deterministic 60 FPS mobile and cross-platform racing simulation. Built in Unity with custom multi-link suspension kinematics, raycast contact normals, dynamic weather friction coefficients, and active aero DRS.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2 font-mono text-[11px] text-[#ff9163]">
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">Fixed 16.66ms Physics</span>
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">Multi-Ray Tire Dynamics</span>
                      <span className="bg-[#050508] px-2 py-1 rounded border border-[rgba(197,196,194,0.08)]">OctaDezx DX12 Flagship</span>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          {/* TAB 2: LIVE 3D MORPH DECK */}
          {activeTab === "3d-engine" && (
            <div className="space-y-4">
              <div className="bg-[#050508] p-4 rounded-lg border border-[rgba(197,196,194,0.1)]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-mono text-xs uppercase tracking-wider text-[#ff5500] font-semibold flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" /> Interactive 3D Target Controller
                  </h4>
                  <span className="font-mono text-[10px] text-[#6f6e6c]">LIVE GPU DISPATCH</span>
                </div>
                <p className="text-xs text-[#a5a4a0] mb-4">
                  Click any state below to command the active 3D particle field in the background viewport. All positions are computed procedurally in vertex shaders.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono text-xs">
                  <button
                    onClick={() => trigger3DShape("accertFormula")}
                    className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                      activeShape === "accertFormula"
                        ? "border-[#ff5500] bg-[#ff5500]/15 text-white"
                        : "border-[rgba(197,196,194,0.1)] bg-[#08080c] text-[#a5a4a0] hover:border-[#ff5500]/50"
                    }`}
                  >
                    <div className="font-bold text-white flex items-center justify-between">
                      Accert One <ChevronRight className="w-3 h-3 text-[#ff5500]" />
                    </div>
                    <div className="text-[10px] text-[#ff9163] mt-1">F1 Aero Monocoque</div>
                  </button>

                  <button
                    onClick={() => trigger3DShape("neuralWeb")}
                    className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                      activeShape === "neuralWeb"
                        ? "border-[#ff5500] bg-[#ff5500]/15 text-white"
                        : "border-[rgba(197,196,194,0.1)] bg-[#08080c] text-[#a5a4a0] hover:border-[#ff5500]/50"
                    }`}
                  >
                    <div className="font-bold text-white flex items-center justify-between">
                      OctaDezx Core <ChevronRight className="w-3 h-3 text-[#ff5500]" />
                    </div>
                    <div className="text-[10px] text-[#ff9163] mt-1">Orbital Synaptic Matrix</div>
                  </button>

                  <button
                    onClick={() => trigger3DShape("nebula")}
                    className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                      activeShape === "nebula"
                        ? "border-[#ff5500] bg-[#ff5500]/15 text-white"
                        : "border-[rgba(197,196,194,0.1)] bg-[#08080c] text-[#a5a4a0] hover:border-[#ff5500]/50"
                    }`}
                  >
                    <div className="font-bold text-white flex items-center justify-between">
                      Cosmic Nebula <ChevronRight className="w-3 h-3 text-[#ff5500]" />
                    </div>
                    <div className="text-[10px] text-[#ff9163] mt-1">Ambient Field</div>
                  </button>

                  <button
                    onClick={() => trigger3DShape("ribbon")}
                    className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                      activeShape === "ribbon"
                        ? "border-[#ff5500] bg-[#ff5500]/15 text-white"
                        : "border-[rgba(197,196,194,0.1)] bg-[#08080c] text-[#a5a4a0] hover:border-[#ff5500]/50"
                    }`}
                  >
                    <div className="font-bold text-white flex items-center justify-between">
                      Studio Ribbon <ChevronRight className="w-3 h-3 text-[#ff5500]" />
                    </div>
                    <div className="text-[10px] text-[#ff9163] mt-1">Sculptural Form</div>
                  </button>

                  <button
                    onClick={() => trigger3DShape("crystal")}
                    className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                      activeShape === "crystal"
                        ? "border-[#ff5500] bg-[#ff5500]/15 text-white"
                        : "border-[rgba(197,196,194,0.1)] bg-[#08080c] text-[#a5a4a0] hover:border-[#ff5500]/50"
                    }`}
                  >
                    <div className="font-bold text-white flex items-center justify-between">
                      Prism Crystal <ChevronRight className="w-3 h-3 text-[#ff5500]" />
                    </div>
                    <div className="text-[10px] text-[#ff9163] mt-1">Geometric Lattice</div>
                  </button>

                  <button
                    onClick={() => trigger3DShape("wave")}
                    className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                      activeShape === "wave"
                        ? "border-[#ff5500] bg-[#ff5500]/15 text-white"
                        : "border-[rgba(197,196,194,0.1)] bg-[#08080c] text-[#a5a4a0] hover:border-[#ff5500]/50"
                    }`}
                  >
                    <div className="font-bold text-white flex items-center justify-between">
                      Harmonic Wave <ChevronRight className="w-3 h-3 text-[#ff5500]" />
                    </div>
                    <div className="text-[10px] text-[#ff9163] mt-1">Fluid Dynamics</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACCERT ONE TELEMETRY SIMULATOR */}
          {activeTab === "accert-sim" && (
            <div className="space-y-4">
              <div className="bg-[#050508] p-4 rounded-lg border border-[rgba(197,196,194,0.1)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h4 className="font-mono text-xs uppercase tracking-wider text-[#ff5500] font-semibold flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5" /> Accert One · Racing Dynamics Simulator
                  </h4>
                  <span className="font-mono text-[10px] text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded border border-[#22c55e]/20">
                    ENGINE: DETERMINISTIC C# · 60 HZ
                  </span>
                </div>

                {/* Circuit selector */}
                <div className="mb-4">
                  <span className="font-mono text-[11px] text-[#6f6e6c] block mb-2">SELECT LASER-SURVEYED CIRCUIT:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                    {Object.entries(CIRCUITS).map(([key, data]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedCircuit(key)}
                        className={`p-2 rounded border text-left cursor-pointer transition-all ${
                          selectedCircuit === key
                            ? "border-[#ff5500] bg-[#ff5500]/10 text-white"
                            : "border-[rgba(197,196,194,0.1)] bg-[#0a0a0f] text-[#8e8d89] hover:text-white"
                        }`}
                      >
                        <div className="font-semibold text-white truncate">{data.name}</div>
                        <div className="text-[10px] text-[#ff9163]">{data.length} · T{data.turns}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Weather selector */}
                <div className="mb-4">
                  <span className="font-mono text-[11px] text-[#6f6e6c] block mb-2">DYNAMIC ATMOSPHERE PRESET:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                    {Object.entries(WEATHERS).map(([key, data]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedWeather(key)}
                        className={`p-2 rounded border text-left cursor-pointer transition-all ${
                          selectedWeather === key
                            ? "border-[#ff5500] bg-[#ff5500]/10 text-white"
                            : "border-[rgba(197,196,194,0.1)] bg-[#0a0a0f] text-[#8e8d89] hover:text-white"
                        }`}
                      >
                        <div className="font-semibold text-white">{data.label}</div>
                        <div className="text-[10px] text-[#ff9163]">Grip: {data.grip}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Telemetry Display */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#08080c] p-3 rounded border border-[rgba(197,196,194,0.08)] font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-[#6f6e6c] block">CIRCUIT SECTOR</span>
                    <span className="text-white font-bold">{CIRCUITS[selectedCircuit].name}</span>
                    <span className="text-[10px] text-[#a5a4a0] block mt-0.5">{CIRCUITS[selectedCircuit].highlight}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6f6e6c] block">TRACTION COEFFICIENT</span>
                    <span className="text-[#ff9163] font-bold">{WEATHERS[selectedWeather].grip} Grip</span>
                    <span className="text-[10px] text-[#a5a4a0] block mt-0.5">{WEATHERS[selectedWeather].temp}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6f6e6c] block">AERO DOWNFORCE COEFFICIENT</span>
                    <span className="text-white font-bold">{drsActive ? "0.68 (LOW DRAG)" : "1.24 (HIGH FORCE)"}</span>
                    <span className="text-[10px] text-[#a5a4a0] block mt-0.5">Venturi Ground Effect: ACTIVE</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#6f6e6c] block">DRS FLAP CONTROL</span>
                    <button
                      onClick={() => setDrsActive(!drsActive)}
                      className={`mt-1 px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-all ${
                        drsActive
                          ? "bg-[#22c55e] text-black"
                          : "bg-[#050508] text-[#c5c4c2] border border-[rgba(197,196,194,0.2)]"
                      }`}
                    >
                      {drsActive ? "DRS [OPEN · ACTIVE]" : "DRS [CLOSED]"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-right">
                  <a
                    href="/work/accert-one"
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-[#ff5500] hover:underline"
                  >
                    Read full Accert One Technical Architecture &rarr;
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OCTADEZX MCP & AGENT CONSOLE */}
          {activeTab === "octadezx-mcp" && (
            <div className="space-y-4">
              <div className="bg-[#050508] p-4 rounded-lg border border-[rgba(197,196,194,0.1)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h4 className="font-mono text-xs uppercase tracking-wider text-[#ff5500] font-semibold flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" /> OctaDezx · Model Context Protocol (MCP) Simulator
                  </h4>
                  <span className="font-mono text-[10px] text-[#22c55e] bg-[#22c55e]/10 px-2 py-0.5 rounded border border-[#22c55e]/20">
                    OAUTH 2.1 + PKCE · MCP RFC-2024
                  </span>
                </div>

                <p className="text-xs text-[#a5a4a0] mb-4">
                  Test the standardized protocol bridge connecting business knowledge, catalog orders, and voice calls to external AI clients without exposing internal reasoning weights.
                </p>

                {/* Client selector */}
                <div className="mb-4">
                  <span className="font-mono text-[11px] text-[#6f6e6c] block mb-2">CONNECTED MCP HOST CLIENT:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
                    {["claude", "cursor", "chatgpt", "gemini", "windsurf"].map((client) => (
                      <button
                        key={client}
                        onClick={() => setMcpClient(client)}
                        className={`p-2 rounded border uppercase text-center cursor-pointer transition-all ${
                          mcpClient === client
                            ? "border-[#ff5500] bg-[#ff5500]/10 text-white font-bold"
                            : "border-[rgba(197,196,194,0.1)] bg-[#0a0a0f] text-[#8e8d89] hover:text-white"
                        }`}
                      >
                        {client}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Console Log Preview */}
                <div className="bg-[#08080c] p-3 rounded border border-[rgba(197,196,194,0.08)] font-mono text-xs space-y-1.5 text-[#c5c4c2]">
                  <div className="flex items-center justify-between text-[11px] text-[#6f6e6c] border-b border-[rgba(197,196,194,0.06)] pb-1.5 mb-1.5">
                    <span>HOST: {mcpClient.toUpperCase()}</span>
                    <span>ENDPOINT: octadezx.com/mcp</span>
                    <span className="text-[#22c55e]">CONNECTED · 18ms</span>
                  </div>
                  <div className="text-[#a5a4a0]">&gt; tools/list: 96 registered connectors available</div>
                  <div className="text-[#a5a4a0]">&gt; call_tool: verify_order_pricing &#123; sku: &quot;AMR25-CF&quot;, units: 1 &#125;</div>
                  <div className="text-[#22c55e]">&gt; response: 200 OK — Server price verified with HMAC signature</div>
                  <div className="text-[#ff9163]">&gt; voice_gateway: SIP audio stream initialized — barge-in listener armed</div>
                </div>

                <div className="mt-3 text-right">
                  <a
                    href="/work/octadezx"
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-[#ff5500] hover:underline"
                  >
                    Read full OctaDezx Enterprise Case Study &rarr;
                  </a>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

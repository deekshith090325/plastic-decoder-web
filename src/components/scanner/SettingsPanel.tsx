import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { PipelineSettings } from "@/lib/vision/types";

interface Props {
  settings: PipelineSettings;
  onChange: (next: PipelineSettings) => void;
}

const SLIDERS: {
  key: keyof Pick<
    PipelineSettings,
    "plasticConfidence" | "personConfidence" | "containmentThreshold" | "personDilation"
  >;
  label: string;
  hint: string;
  min: number;
  max: number;
}[] = [
  {
    key: "plasticConfidence",
    label: "Plastic confidence",
    hint: "Minimum detector score to keep a box",
    min: 0.05,
    max: 0.95,
  },
  {
    key: "personConfidence",
    label: "Person confidence",
    hint: "Minimum score for a person box to count",
    min: 0.05,
    max: 0.95,
  },
  {
    key: "containmentThreshold",
    label: "Containment threshold",
    hint: "Share of a plastic box inside a person before it is rejected",
    min: 0.1,
    max: 1,
  },
  {
    key: "personDilation",
    label: "Person box margin",
    hint: "Grows person boxes to catch items held at the edge",
    min: 0,
    max: 0.4,
  },
];

export function SettingsPanel({ settings, onChange }: Props) {
  return (
    <section className="panel space-y-5 p-5">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Person exclusion
          </h2>
          <p className="text-xs text-muted-foreground">
            Stage 2 filter — thresholds are demo defaults and need tuning on real footage.
          </p>
        </div>
        <Switch
          checked={settings.personFilterEnabled}
          onCheckedChange={(checked) =>
            onChange({ ...settings, personFilterEnabled: checked })
          }
          aria-label="Toggle person exclusion filter"
        />
      </header>

      <div className="space-y-5">
        {SLIDERS.map((slider) => (
          <div key={slider.key} className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label className="text-sm">{slider.label}</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {settings[slider.key].toFixed(2)}
              </span>
            </div>
            <Slider
              value={[settings[slider.key]]}
              min={slider.min}
              max={slider.max}
              step={0.01}
              onValueChange={([value]) =>
                onChange({ ...settings, [slider.key]: value ?? settings[slider.key] })
              }
            />
            <p className="text-xs text-muted-foreground">{slider.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

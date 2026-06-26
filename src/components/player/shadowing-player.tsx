import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SPEAKER_COLORS } from '@/lib/constants/speakers';

export function ShadowingPlayer() {
  return (
    <div className="space-y-6">
      {/* Dark Navy player surface */}
      <Card variant="productMockup" className="overflow-hidden">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Badge variant="coral">Focus Mode</Badge>
              <h4 className="font-serif text-2xl text-on-dark mt-2 font-normal">
                No Stupid Questions
              </h4>
              <p className="text-xs text-on-dark-soft font-sans">
                Episode #123: Duckworth & Dubner Discussion
              </p>
            </div>

            {/* Simple audio visualizer placeholder */}
            <div className="flex items-end gap-1 h-8">
              <div className="w-1 bg-primary h-6 animate-pulse" />
              <div className="w-1 bg-primary h-4 animate-pulse delay-75" />
              <div className="w-1 bg-primary h-7 animate-pulse delay-150" />
              <div className="w-1 bg-primary h-3 animate-pulse" />
            </div>
          </div>

          {/* Audio controller mockup */}
          <div className="bg-surface-dark-soft border border-surface-dark-elevated rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between text-xs text-on-dark-soft">
              <span>01:24</span>
              <div className="flex-1 mx-4 h-1 bg-surface-dark-elevated rounded-full relative">
                <div className="absolute left-0 top-0 h-full w-1/3 bg-primary rounded-full" />
              </div>
              <span>05:32</span>
            </div>

            <div className="flex items-center justify-center gap-4">
              <Button variant="secondaryOnDark" size="sm">
                Prev Segment
              </Button>
              <Button variant="primary" size="icon" className="rounded-full">
                ▶
              </Button>
              <Button variant="secondaryOnDark" size="sm">
                Next Segment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Script reader canvas - editorial design */}
      <Card variant="feature" className="p-8 space-y-6">
        <div className="border-b border-hairline pb-4 flex items-center justify-between">
          <h5 className="font-serif text-xl text-ink font-normal">
            Active Transcript
          </h5>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm">
              All Speakers
            </Button>
            <Button variant="secondary" size="sm">
              Angela Only
            </Button>
          </div>
        </div>

        {/* Script lines */}
        <div className="space-y-6 font-sans text-body">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold ${SPEAKER_COLORS.DUCKWORTH.textClass}`}
              >
                {SPEAKER_COLORS.DUCKWORTH.name}
              </span>
              <span className="text-[10px] text-muted-soft">01:24</span>
            </div>
            <p className="text-base text-ink leading-relaxed">
              I think human behavior is incredibly hard to change, but if you
              look at the statistics, even a small nudge makes a significant
              difference.
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold ${SPEAKER_COLORS.DUBNER.textClass}`}
              >
                {SPEAKER_COLORS.DUBNER.name}
              </span>
              <span className="text-[10px] text-muted-soft">01:45</span>
            </div>
            <p className="text-base text-ink leading-relaxed">
              Wait, Angela. Are you saying that a simple policy change can
              overcome decades of habits? That sounds too optimistic, even for
              you.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

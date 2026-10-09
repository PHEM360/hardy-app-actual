import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useCalendar } from "@/hooks/useCalendar";
import { useBirthdays } from "@/hooks/useBirthdays";
import { useActiveHousehold } from "@/hooks/useActiveHousehold";
import {
  acknowledgeOccasion,
  pendingUrgentOccasions,
  todaysUrgentOccasions,
} from "@/lib/urgentOccasions";

export function useUrgentOccasions() {
  const { events } = useCalendar();
  const { activeHouseholdId } = useActiveHousehold();
  const { birthdays } = useBirthdays(activeHouseholdId);
  const [ackTick, setAckTick] = useState(0);
  const day = format(new Date(), "yyyy-MM-dd");

  const current = useMemo(() => {
    void ackTick;
    return pendingUrgentOccasions(todaysUrgentOccasions({ birthdays, events }), day)[0] ?? null;
  }, [ackTick, birthdays, day, events]);

  const acknowledge = () => {
    if (!current) return;
    acknowledgeOccasion(current.id, day);
    setAckTick((value) => value + 1);
  };

  return { current, acknowledge };
}

import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius } from "@/lib/theme";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function toKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Calendário de período: escolhe início/fim tocando nos dias e mostra um
// pontinho nos dias que tiveram dia de venda — um panorama do mês.
export function RangeCalendar({
  start,
  end,
  onChange,
  marked
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  marked: Set<string>;
}) {
  const [cursor, setCursor] = useState(() => {
    const base = start || end;
    const year = Number(base?.slice(0, 4));
    const month = Number(base?.slice(5, 7));
    if (year && month) return { year, month: month - 1 };
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay();
  const todayKey = toKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  function shiftMonth(delta: number) {
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function pick(key: string) {
    if (start && end && start !== end) {
      // Período completo: começa uma seleção nova.
      onChange(key, key);
    } else if (start && key < start) {
      onChange(key, end || start);
    } else if (start) {
      onChange(start, key);
    } else {
      onChange(key, key);
    }
  }

  const cells: ({ day: number; key: string } | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      key: toKey(cursor.year, cursor.month, index + 1)
    }))
  ];

  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <Pressable onPress={() => shiftMonth(-1)} style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}>
          <ChevronLeft size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTHS[cursor.month]} {cursor.year}
        </Text>
        <Pressable onPress={() => shiftMonth(1)} style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}>
          <ChevronRight size={20} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((weekday, index) => (
          <Text key={`${weekday}-${index}`} style={styles.weekday}>
            {weekday}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, index) => {
          if (!cell) return <View key={`empty-${index}`} style={styles.cell} />;

          const isStart = cell.key === start;
          const isEnd = cell.key === end;
          const inRange = start && end ? cell.key > start && cell.key < end : false;
          const selected = isStart || isEnd;
          const hasSale = marked.has(cell.key);
          const isToday = cell.key === todayKey;

          return (
            <View key={cell.key} style={[styles.cell, inRange && styles.cellInRange]}>
              <Pressable
                onPress={() => pick(cell.key)}
                style={({ pressed }) => [
                  styles.dayButton,
                  selected && styles.daySelected,
                  !selected && isToday ? styles.dayToday : null,
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.dayText, inRange && styles.dayTextInRange, selected && styles.dayTextSelected]}>
                  {cell.day}
                </Text>
                <View style={[styles.dot, hasSale ? (selected ? styles.dotSelected : styles.dotVisible) : null]} />
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        <View style={[styles.dot, styles.dotVisible, styles.legendDot]} />
        <Text style={styles.legendText}>dia com venda registrada</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: {
    gap: 8
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  navButton: {
    height: 38,
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceWarm
  },
  monthTitle: {
    color: colors.ink,
    fontSize: 17,
    fontFamily: fonts.display
  },
  pressed: {
    opacity: 0.75
  },
  weekRow: {
    flexDirection: "row"
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.bodyBold
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    paddingVertical: 2
  },
  cellInRange: {
    backgroundColor: colors.brandSoft
  },
  dayButton: {
    height: 42,
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill
  },
  daySelected: {
    backgroundColor: colors.brandDeep
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: colors.brand
  },
  dayText: {
    color: colors.ink,
    fontSize: 14,
    fontFamily: fonts.bodyBold
  },
  dayTextInRange: {
    color: colors.brandDeep
  },
  dayTextSelected: {
    color: "#fff"
  },
  dot: {
    marginTop: 2,
    height: 5,
    width: 5,
    borderRadius: 3,
    backgroundColor: "transparent"
  },
  dotVisible: {
    backgroundColor: colors.brandDeep
  },
  dotSelected: {
    backgroundColor: "#fff"
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center"
  },
  legendDot: {
    marginTop: 0
  },
  legendText: {
    color: colors.muted,
    fontSize: 12,
    fontFamily: fonts.body
  }
});

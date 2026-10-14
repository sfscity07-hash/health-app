import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModalHeader } from '@/components/food/ModalHeader';
import { DayNav } from '@/components/foodlog/DayNav';
import { AnimatedBar } from '@/components/ui/AnimatedBar';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { loadErrorMessage } from '@/features/auth/errors';
import { useDayNutrients } from '@/features/nutrients/api';
import { formatAmount, NUTRIENTS, saltFromSodium, type DayNutrient, type NutrientInfo, type NutrientTarget } from '@/features/nutrients/micros';
import { fromISODate, toISODate } from '@/lib/dates';
import { formatDayLabel } from '@/lib/format';
import { useTheme } from '@/theme/theme';
import { gutter, space } from '@/theme/tokens';

const SECTIONS: { group: NutrientInfo['group']; title: string; hint: string }[] = [
  { group: 'limit', title: 'Keep under', hint: 'Upper limits for the day.' },
  { group: 'mineral', title: 'Minerals', hint: 'Recommended amounts for you.' },
  { group: 'vitamin', title: 'Vitamins', hint: 'Recommended amounts for you.' },
];

/** "Maggi and Chai", "Maggi, Chai and 2 more". */
function names(list: string[]) {
  const unique = [...new Set(list)];
  if (unique.length <= 2) return unique.join(' and ');
  return `${unique.slice(0, 2).join(', ')} and ${unique.length - 2} more`;
}

/**
 * A day's vitamins, minerals, salt and caffeine against what's right for you.
 * Every number says how sure it is: ≈ marks estimates, and foods without data
 * are named rather than counted as zero. Tap a nutrient to see where it came from.
 */
export default function NutrientsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();
  const today = toISODate(new Date());
  const [date, setDate] = useState(params.date || today);
  const n = useDayNutrients(date);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ModalHeader title="Nutrients" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.intro}>
          <View style={styles.titleRow}>
            <Text variant="title" accessibilityRole="header" style={styles.flex}>
              {formatDayLabel(fromISODate(date))}
            </Text>
            <DayNav date={date} today={today} onChange={setDate} />
          </View>
          <Text variant="small" color="textSecondary">
            {n.entries === 0
              ? 'Nothing logged this day.'
              : `From the ${n.entries} food${n.entries === 1 ? '' : 's'} you logged. ≈ marks an estimate; foods that don’t list a nutrient are named, never counted as zero.`}
          </Text>
          {n.filling ? (
            <View style={styles.filling} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text variant="caption" color="textSecondary">
                Looking up vitamins and minerals for your foods…
              </Text>
            </View>
          ) : null}
        </View>

        {n.error ? (
          <Text variant="small" color="warn">
            {loadErrorMessage(n.error)}
          </Text>
        ) : null}
        {n.ready === false ? (
          <Card style={styles.notice}>
            <Text variant="bodyStrong">Vitamins and minerals need a database update</Text>
            <Text variant="small" color="textSecondary">
              Salt, sugar and caffeine work already. For the rest, run the newest file in supabase/migrations (micronutrients) in your Supabase SQL Editor, then come back here.
            </Text>
          </Card>
        ) : null}

        {n.pending ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" /> : null}

        {!n.pending && n.entries > 0
          ? SECTIONS.map((s) => (
              <View key={s.group} style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text variant="label">{s.title}</Text>
                  <Text variant="caption" color="textTertiary">
                    {s.hint}
                  </Text>
                </View>
                <Card style={styles.card}>
                  {NUTRIENTS.filter((x) => x.group === s.group).map((info, i) => (
                    <NutrientRow
                      key={info.key}
                      info={info}
                      day={n.day[info.key]}
                      target={n.goals[info.key]}
                      entries={n.entries}
                      first={i === 0}
                      open={open === info.key}
                      onToggle={() => setOpen((o) => (o === info.key ? null : info.key))}
                    />
                  ))}
                </Card>
              </View>
            ))
          : null}

        {!n.pending && n.entries > 0 ? (
          <Text variant="caption" color="textTertiary">
            Numbers come from each food’s label (Open Food Facts, USDA, or what you typed). For simple foods like yoghurt, milk or oats, anything the label leaves out is
            borrowed from USDA’s plain version of the same food and marked ≈. Caffeine for coffee, tea, cola and chocolate uses typical amounts unless the label says. Targets are
            the US National Academies’ recommendations for your sex and age.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function NutrientRow({
  info,
  day,
  target,
  entries,
  first,
  open,
  onToggle,
}: {
  info: NutrientInfo;
  day: DayNutrient;
  target: NutrientTarget;
  entries: number;
  first: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const noData = day.missing.length === entries && day.amount === 0;
  const fraction = target.amount > 0 ? day.amount / target.amount : 0;
  const over = target.kind === 'limit' && day.amount > target.amount;
  const met = target.kind === 'goal' && day.amount >= target.amount;
  const salt = info.key === 'sodium_mg';
  const amount = noData ? 'No data' : `${day.estimated ? '≈ ' : ''}${salt ? `${saltFromSodium(day.amount).toFixed(1)} g` : formatAmount(day.amount, info.unit)}`;
  const of = salt ? `${saltFromSodium(target.amount).toFixed(1)} g` : formatAmount(target.amount, info.unit);
  // Salt reads in grams of salt everywhere on this row; the sodium is in the line under it.
  const fmt = (v: number) => (salt ? (v > 0 && v < 4 ? '<0.01 g' : `${saltFromSodium(v).toFixed(v < 400 ? 2 : 1)} g`) : formatAmount(v, info.unit));
  const status = over ? `Over by ${salt ? `${saltFromSodium(day.amount - target.amount).toFixed(1)} g` : formatAmount(day.amount - target.amount, info.unit)}` : met ? 'Met' : null;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${info.label}: ${amount}${salt && !noData ? `, ${Math.round(day.amount)} milligrams of sodium` : ''}, ${Math.round(fraction * 100)}% of ${of}${status ? `, ${status}` : ''}.${
        day.missing.length && !noData ? ` ${day.missing.length} food${day.missing.length === 1 ? '' : 's'} had no data.` : ''
      } Tap to see where it came from.`}
      pressedScale={1}
      haptic="tick"
      onPress={onToggle}
      style={[styles.row, !first && { borderTopColor: colors.hairline, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
      <View style={styles.rowHead}>
        <Text variant="bodyStrong" style={styles.flex}>
          {info.label}
        </Text>
        <Text variant="bodyStrong" color={noData ? 'textTertiary' : 'text'} tabular>
          {amount}
        </Text>
        <Text variant="caption" color="textTertiary" tabular>
          {' '}
          / {of}
        </Text>
      </View>
      <AnimatedBar fraction={noData ? 0 : fraction} color={over ? colors.warn : colors.accent} track={colors.accentSoft} height={6} />
      <View style={styles.rowFoot}>
        <Text variant="caption" color="textSecondary" style={styles.flex} numberOfLines={open ? undefined : 1}>
          {noData
            ? 'None of your foods list it.'
            : day.missing.length
              ? `No data from ${names(day.missing)}`
              : salt
                ? `${formatAmount(day.amount, 'mg')} sodium`
                : `${Math.round(fraction * 100)}% of ${target.kind === 'limit' ? 'the limit' : 'your target'}`}
        </Text>
        {status ? (
          <View style={styles.status}>
            <Icon name={over ? 'flag' : 'check'} size={12} color={over ? 'warn' : 'good'} strokeWidth={2.6} />
            <Text variant="caption" color={over ? 'warn' : 'good'}>
              {status}
            </Text>
          </View>
        ) : null}
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} color="textTertiary" />
      </View>
      {open ? (
        <View style={[styles.detail, { borderTopColor: colors.hairline }]}>
          <Text variant="caption" color="textTertiary">
            {target.note}
          </Text>
          {day.from.map((f, i) => (
            <View key={`${f.name}-${i}`} style={styles.fromRow}>
              <View style={styles.flex}>
                <Text variant="small" numberOfLines={1}>
                  {f.name}
                </Text>
                {f.note ? (
                  <Text variant="caption" color="textTertiary" numberOfLines={2}>
                    ≈ {f.note}
                  </Text>
                ) : null}
              </View>
              <Text variant="small" color="textSecondary" tabular>
                {fmt(f.amount)}
              </Text>
            </View>
          ))}
          {day.missing.length ? (
            <Text variant="caption" color="textTertiary">
              No data: {[...new Set(day.missing)].join(', ')}
            </Text>
          ) : null}
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: gutter, gap: space.xl },
  intro: { gap: space.xs, marginTop: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  filling: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  notice: { padding: space.lg, gap: space.xs },
  section: { gap: space.xs },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  card: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  row: { paddingVertical: space.md, gap: space.sm },
  rowHead: { flexDirection: 'row', alignItems: 'baseline' },
  rowFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  status: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  detail: { gap: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  fromRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
});

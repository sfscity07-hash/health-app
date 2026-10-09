import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Stepper } from '@/components/ui/Stepper';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { Text } from '@/components/ui/Text';
import { formatTime, REMINDERS, shiftTime, type ReminderKey } from '@/features/reminders/logic';
import { ensurePermission, remindersSupported } from '@/features/reminders/notify';
import { useReminderSettings } from '@/store/reminders';
import { useToast } from '@/store/toast';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

/** Each reminder with its own switch and time. They skip themselves on days you've already done the thing. */
export function RemindersCard() {
  const { colors } = useTheme();
  const settings = useReminderSettings((s) => s.settings);
  const update = useReminderSettings((s) => s.update);
  const showToast = useToast((s) => s.show);

  async function toggle(key: ReminderKey, on: boolean) {
    if (on && !(await ensurePermission())) {
      showToast('Notifications are off for this app. Turn them on in your phone’s settings, then try again.', 'warn');
      return;
    }
    update(key, { on });
  }

  return (
    <Card style={styles.card}>
      <Text variant="label">Reminders</Text>
      {!remindersSupported ? (
        <Text variant="small" color="textSecondary">
          Reminders work in the app on your phone.
        </Text>
      ) : (
        REMINDERS.map((r, i) => {
          const s = settings[r.key];
          return (
            <View key={r.key} style={[styles.item, i > 0 && { borderTopColor: colors.hairline, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
              <SwitchRow
                label={r.label}
                description={`${s.on ? `${r.key === 'checkin' ? 'Mondays' : 'Daily'} at ${formatTime(s.time)}. ` : ''}${r.description}`}
                value={s.on}
                onChange={(on) => void toggle(r.key, on)}
              />
              {s.on ? (
                <Stepper
                  label="Time"
                  value={formatTime(s.time)}
                  onMinus={() => update(r.key, { time: shiftTime(s.time, -15) })}
                  onPlus={() => update(r.key, { time: shiftTime(s.time, 15) })}
                />
              ) : null}
            </View>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md },
  item: { gap: space.sm, paddingTop: space.sm },
});

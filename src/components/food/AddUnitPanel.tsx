import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { parseUnit, UNIT_SUGGESTIONS } from '@/features/food/forms';
import { isMillilitres, type Serving } from '@/lib/portion';
import { space } from '@/theme/tokens';

type AddUnitPanelProps = {
  /** Units the food already has, so they aren't offered again. */
  existing: string[];
  onSave: (serving: Serving) => void;
  onCancel: () => void;
};

/** "Add a unit": pick or type a name (scoop, cup…) and say what one weighs. */
export function AddUnitPanel({ existing, onSave, onCancel }: AddUnitPanelProps) {
  const taken = existing.map((e) => e.toLowerCase());
  const suggestions = UNIT_SUGGESTIONS.filter((u) => !taken.includes(u));
  const [choice, setChoice] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [grams, setGrams] = useState('');
  const [error, setError] = useState<string | null>(null);
  const name = choice === 'other' ? custom.trim().toLowerCase() : (choice ?? '');
  const ml = isMillilitres(name);

  function pick(value: string) {
    setChoice(value);
    setError(null);
    // Most drinks weigh about a gram per millilitre.
    if (isMillilitres(value) && grams === '') setGrams('1');
  }

  function save() {
    const parsed = parseUnit({ label: name, grams }, existing);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    onSave(parsed.serving);
  }

  return (
    <View style={styles.panel}>
      <Text variant="label">Add a unit</Text>
      <ChipGroup label="Unit">
        {suggestions.map((u) => (
          <Chip key={u} label={u} selected={choice === u} onPress={() => pick(u)} />
        ))}
        <Chip label="Other…" selected={choice === 'other'} onPress={() => pick('other')} />
      </ChipGroup>
      {choice === 'other' ? (
        <TextField label="Unit name" value={custom} onChangeText={setCustom} placeholder="e.g. handful, glass" autoCapitalize="none" autoFocus maxLength={40} />
      ) : null}
      {choice ? (
        <TextField
          label={ml ? '1 ml weighs' : `1 ${name || 'unit'} weighs`}
          suffix="g"
          value={grams}
          onChangeText={(v) => {
            setGrams(v);
            setError(null);
          }}
          keyboardType="decimal-pad"
          placeholder={ml ? '1' : 'e.g. 30'}
          autoFocus={choice !== 'other'}
        />
      ) : null}
      {error ? (
        <Text variant="small" color="warn" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : (
        <Text variant="caption" color="textTertiary">
          {ml ? 'Most drinks are about 1 g per ml; milk is 1.03.' : 'Check the label: it often says “1 scoop (30 g)”. Or weigh one.'}
        </Text>
      )}
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={styles.flex}>
          <Button label="Add unit" onPress={save} disabled={!choice} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space.md },
  actions: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});

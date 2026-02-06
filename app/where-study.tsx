import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '@/components/ProgressBar';
import { updateOnboarding } from '@/lib/onboarding-storage';

const BUTTON_SHADOW = {
  shadowColor: '#333333',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 6,
  elevation: 6,
};

const COUNTRY_OPTIONS = [
  'United States',
  'Canada',
  'Australia',
  'Brazil',
  'China',
  'France',
  'Germany',
  'India',
  'Ireland',
  'Italy',
  'Japan',
  'Mexico',
  'Netherlands',
  'New Zealand',
  'Nigeria',
  'Norway',
  'Pakistan',
  'Philippines',
  'Poland',
  'Portugal',
  'Russia',
  'Saudi Arabia',
  'Singapore',
  'South Africa',
  'South Korea',
  'Spain',
  'Sweden',
  'Switzerland',
  'Turkey',
  'United Arab Emirates',
  'United Kingdom',
  'Vietnam',
] as const;

const US_STATES = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
] as const;

const CANADA_PROVINCES_AND_TERRITORIES = [
  'Alberta',
  'British Columbia',
  'Manitoba',
  'New Brunswick',
  'Newfoundland and Labrador',
  'Northwest Territories',
  'Nova Scotia',
  'Nunavut',
  'Ontario',
  'Prince Edward Island',
  'Quebec',
  'Saskatchewan',
  'Yukon',
] as const;

type CountryOption = (typeof COUNTRY_OPTIONS)[number];

export default function WhereStudyScreen() {
  const insets = useSafeAreaInsets();
  const [country, setCountry] = useState<CountryOption>('United States');
  const [region, setRegion] = useState('Texas');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);

  const showRegion = country === 'United States' || country === 'Canada';
  const regionLabel = country === 'Canada' ? 'Province' : 'State';
  const regionOptions =
    country === 'Canada'
      ? [...CANADA_PROVINCES_AND_TERRITORIES]
      : [...US_STATES];

  const SelectModal = ({
    title,
    options,
    onSelect,
    onClose,
  }: {
    title: string;
    options: string[];
    onSelect: (value: string) => void;
    onClose: () => void;
  }) => (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {options.map((o) => (
              <Pressable
                key={o}
                style={styles.modalOption}
                onPress={() => {
                  onSelect(o);
                  onClose();
                }}
              >
                <Text style={styles.modalOptionText}>{o}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return (
    <LinearGradient colors={['#C4C4C4', '#AADDDD']} locations={[0, 0.63]} style={styles.gradient}>
      <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <ProgressBar progress={20} />
        <Text style={[styles.title, { marginTop: 24 }]}>Where do you study?</Text>

        <View style={styles.dropdownRow}>
          <Pressable style={styles.dropdownBtn} onPress={() => setShowCountryPicker(true)}>
            <View style={styles.dropdownTextCol}>
              <Text style={styles.dropdownLabelInBtn}>Country</Text>
              <Text style={styles.dropdownValue}>{country || 'United States'}</Text>
            </View>
            <Text style={styles.dropdownArrow}>▼</Text>
          </Pressable>
        </View>
        {showRegion ? (
          <View style={styles.dropdownRow}>
            <Pressable style={styles.dropdownBtn} onPress={() => setShowRegionPicker(true)}>
              <View style={styles.dropdownTextCol}>
                <Text style={styles.dropdownLabelInBtn}>{regionLabel}</Text>
                <Text style={styles.dropdownValue}>{region || 'Texas'}</Text>
              </View>
              <Text style={styles.dropdownArrow}>▼</Text>
            </Pressable>
          </View>
        ) : null}

        <Image source={require('../assets/travelpup.png')} style={styles.puppy} contentFit="contain" />

        <View style={styles.buttons}>
          <Pressable
            style={styles.continueBtn}
            onPress={async () => {
              await updateOnboarding({ country, region: showRegion ? region : undefined });
              router.push('/grade-level');
            }}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </Pressable>
        </View>
      </View>
      {showCountryPicker ? (
        <SelectModal
          title="Select country"
          options={[...COUNTRY_OPTIONS]}
          onSelect={(v) => {
            const next = v as CountryOption;
            setCountry(next);
            if (next === 'Canada') setRegion('Ontario');
            else if (next === 'United States') setRegion('Texas');
            else setRegion('');
          }}
          onClose={() => setShowCountryPicker(false)}
        />
      ) : null}
      {showRegionPicker && showRegion ? (
        <SelectModal
          title={`Select ${regionLabel.toLowerCase()}`}
          options={regionOptions}
          onSelect={setRegion}
          onClose={() => setShowRegionPicker(false)}
        />
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  title: { fontFamily: 'FredokaOne_400Regular', fontSize: 28, color: '#000', textAlign: 'center', marginBottom: 24 },
  dropdownRow: { marginBottom: 52 },
  dropdownBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#ddd',
    ...BUTTON_SHADOW,
  },
  dropdownTextCol: { flex: 1, justifyContent: 'center' },
  dropdownLabelInBtn: { fontFamily: 'Fredoka_400Regular', fontSize: 12, color: '#666', marginBottom: 2 },
  dropdownValue: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#000' },
  dropdownArrow: { fontSize: 12, color: '#666' },
  puppy: {
    flex: 1,
    width: '100%',
    maxHeight: 240,
    alignSelf: 'center',
    marginVertical: 24,
  },
  buttons: { marginTop: 'auto', paddingTop: 6, marginBottom: -34 },
  continueBtn: {
    backgroundColor: '#FD8A8A',
    borderRadius: 35,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CA6E6E',
    ...BUTTON_SHADOW,
  },
  continueBtnText: { fontFamily: 'Fredoka_400Regular', fontSize: 24, color: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: '70%' },
  modalTitle: { fontFamily: 'FredokaOne_400Regular', fontSize: 20, marginBottom: 16, textAlign: 'center' },
  modalOption: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 10 },
  modalOptionText: { fontFamily: 'Fredoka_400Regular', fontSize: 16, color: '#000' },
});

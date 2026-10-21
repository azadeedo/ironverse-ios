// ============================================================
// RESEARCH / WHY THIS RECOMMENDATION
//
// Only well-known, published sources are listed. Volume/page numbers and DOIs
// are deliberately omitted rather than risk getting one wrong — search the
// title to find the paper. Evidence strength is stated honestly: nothing here
// is called "scientifically proven best".
// ============================================================

export interface Ref {
  id: string
  authors: string
  year: number
  title: string
  source: string
  kind: 'meta-analysis' | 'systematic review' | 'position stand' | 'controlled trial' | 'consensus' | 'method' | 'cohort meta-analysis' | 'educational' | 'historical'
}

export const REFS: Ref[] = [
  { id: 'schoenfeld-volume-2017', authors: 'Schoenfeld BJ, Ogborn D, Krieger JW', year: 2017, title: 'Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis', source: 'Journal of Sports Sciences', kind: 'meta-analysis' },
  { id: 'schoenfeld-load-2017', authors: 'Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW', year: 2017, title: 'Strength and hypertrophy adaptations between low- vs. high-load resistance training: a systematic review and meta-analysis', source: 'Journal of Strength and Conditioning Research', kind: 'meta-analysis' },
  { id: 'schoenfeld-frequency-2016', authors: 'Schoenfeld BJ, Ogborn D, Krieger JW', year: 2016, title: 'Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis', source: 'Sports Medicine', kind: 'meta-analysis' },
  { id: 'schoenfeld-frequency-2019', authors: 'Schoenfeld BJ, Grgic J, Krieger J', year: 2019, title: 'How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis of studies examining the effects of resistance training frequency', source: 'Journal of Sports Sciences', kind: 'meta-analysis' },
  { id: 'grgic-rest-2018', authors: 'Grgic J, Schoenfeld BJ, Skrepnik M, Davies TB, Mikulic P', year: 2018, title: 'Effects of rest interval duration in resistance training on measures of muscular strength: a systematic review', source: 'Sports Medicine', kind: 'systematic review' },
  { id: 'refalo-failure-2023', authors: 'Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ', year: 2023, title: 'Influence of resistance training proximity-to-failure on skeletal muscle hypertrophy: a systematic review with meta-analysis', source: 'Sports Medicine', kind: 'meta-analysis' },
  { id: 'helms-rir-2016', authors: 'Helms ER, Cronin J, Storey A, Zourdos MC', year: 2016, title: 'Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training', source: 'Strength and Conditioning Journal', kind: 'method' },
  { id: 'zourdos-rir-2016', authors: 'Zourdos MC, Klemp A, Dolan C, et al.', year: 2016, title: 'Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve', source: 'Journal of Strength and Conditioning Research', kind: 'controlled trial' },
  { id: 'maeo-hamstrings-2021', authors: 'Maeo S, Huang M, Wu Y, et al.', year: 2021, title: 'Greater hamstrings muscle hypertrophy but similar damage protection after training at long versus short muscle lengths', source: 'Medicine & Science in Sports & Exercise', kind: 'controlled trial' },
  { id: 'maeo-triceps-2023', authors: 'Maeo S, Wu Y, Huang M, et al.', year: 2023, title: 'Triceps brachii hypertrophy is substantially greater after elbow extension training performed in the overhead versus neutral arm position', source: 'European Journal of Sport Science', kind: 'controlled trial' },
  { id: 'pallares-rom-2021', authors: 'Pallarés JG, Hernández-Belmonte A, Martínez-Cava A, et al.', year: 2021, title: 'Effects of range of motion on resistance training adaptations: a systematic review and meta-analysis', source: 'Scandinavian Journal of Medicine & Science in Sports', kind: 'meta-analysis' },
  { id: 'acsm-2009', authors: 'American College of Sports Medicine', year: 2009, title: 'Progression models in resistance training for healthy adults (position stand)', source: 'Medicine & Science in Sports & Exercise', kind: 'position stand' },
  { id: 'murphy-deficit-2022', authors: 'Murphy C, Koehler K', year: 2022, title: 'Energy deficiency impairs resistance training gains in lean mass but not strength: a meta-analysis and meta-regression', source: 'Scandinavian Journal of Medicine & Science in Sports', kind: 'meta-analysis' },
  { id: 'wilson-concurrent-2012', authors: 'Wilson JM, Marin PJ, Rhea MR, et al.', year: 2012, title: 'Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises', source: 'Journal of Strength and Conditioning Research', kind: 'meta-analysis' },
  { id: 'schumann-concurrent-2022', authors: 'Schumann M, Feuerbacher JF, Sünkeler M, et al.', year: 2022, title: 'Compatibility of concurrent aerobic and strength training for skeletal muscle size and function: an updated systematic review and meta-analysis', source: 'Sports Medicine', kind: 'meta-analysis' },
  { id: 'helms-prep-2014', authors: 'Helms ER, Aragon AA, Fitschen PJ', year: 2014, title: 'Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation', source: 'Journal of the International Society of Sports Nutrition', kind: 'systematic review' },
  { id: 'morton-protein-2018', authors: 'Morton RW, Murphy KT, McKellar SR, et al.', year: 2018, title: 'A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults', source: 'British Journal of Sports Medicine', kind: 'meta-analysis' },
  { id: 'bickel-maintenance-2011', authors: 'Bickel CS, Cross JM, Bamman MM', year: 2011, title: 'Exercise dosing to retain resistance training adaptations in young and older adults', source: 'Medicine & Science in Sports & Exercise', kind: 'controlled trial' },
  { id: 'bell-deload-2023', authors: 'Bell L, Strafford BW, Coleman M, Androulakis Korakakis P, Nolan D', year: 2023, title: 'Integrating deloading into strength and physique sports training programmes: an international Delphi consensus approach', source: 'Sports Medicine – Open', kind: 'consensus' },
  { id: 'pritchard-taper-2015', authors: 'Pritchard H, Keogh J, Barnes M, McGuigan M', year: 2015, title: 'Effects and mechanisms of tapering in maximizing muscular strength', source: 'Strength and Conditioning Journal', kind: 'systematic review' },
  { id: 'iversen-time-2021', authors: 'Iversen VM, Norum M, Schoenfeld BJ, Fimland MS', year: 2021, title: 'No time to lift? Designing time-efficient training programs for strength and hypertrophy: a narrative review', source: 'Sports Medicine', kind: 'systematic review' },
  { id: 'paluch-steps-2022', authors: 'Paluch AE, Bajpai S, Bassett DR, et al.', year: 2022, title: 'Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts', source: 'The Lancet Public Health', kind: 'cohort meta-analysis' },
  { id: 'epley-1985', authors: 'Epley B', year: 1985, title: 'Poundage Chart (Boyd Epley Workout)', source: 'Body Enterprises, Lincoln NE', kind: 'method' },
  { id: 'nippard', authors: 'Jeff Nippard', year: 2024, title: 'Evidence-based training education (videos and programs)', source: 'Educational influence — not peer-reviewed evidence', kind: 'educational' },
  { id: 'arnold-encyclopedia', authors: 'Schwarzenegger A, Dobbins B', year: 1998, title: 'The New Encyclopedia of Modern Bodybuilding', source: 'Simon & Schuster — historical bodybuilding context, not scientific evidence', kind: 'historical' },
]

export interface Principle {
  id: string
  title: string
  summary: string
  inApp: string
  refs: string[]
  strength: 'strong' | 'moderate' | 'emerging' | 'practical'
}

export const PRINCIPLES: Principle[] = [
  { id: 'specificity', title: 'Strength is specific', summary: 'Heavier loads and practice of the actual lift produce the largest strength gains in that lift.', inApp: 'Squat, bench and deadlift are practised directly every week, with heavier work in the strength blocks.', refs: ['schoenfeld-load-2017', 'acsm-2009'], strength: 'strong' },
  { id: 'load-range', title: 'Muscle grows across a broad load range', summary: 'Light and heavy loads produce similar hypertrophy when sets are taken reasonably close to failure.', inApp: 'Accessories use moderate rep ranges (8–20); you do not need to go heavy on everything to grow.', refs: ['schoenfeld-load-2017'], strength: 'strong' },
  { id: 'volume', title: 'Weekly volume matters for hypertrophy', summary: 'More weekly sets per muscle are associated with more growth, up to a point; multiple sets beat very low volume.', inApp: 'Weekly direct-set targets per muscle (e.g. chest 10–14) — programming targets, not biological thresholds.', refs: ['schoenfeld-volume-2017'], strength: 'strong' },
  { id: 'frequency', title: 'Frequency mostly distributes volume', summary: 'When weekly volume is equal, training a muscle more often gives small or no extra growth — it mainly improves session quality.', inApp: 'Each muscle is hit about twice a week so no single session gets too long.', refs: ['schoenfeld-frequency-2016', 'schoenfeld-frequency-2019'], strength: 'moderate' },
  { id: 'failure', title: 'Failure is not required', summary: 'Training close to failure appears important for hypertrophy, but going all the way to failure on every set is not necessary.', inApp: 'Most work is 1–3 reps in reserve depending on the phase; isolations may occasionally reach 0–1 RIR.', refs: ['refalo-failure-2023', 'helms-rir-2016'], strength: 'moderate' },
  { id: 'rir', title: 'Reps in reserve to autoregulate', summary: 'RIR-based RPE lets load match how strong you are on the day.', inApp: 'Every set has an RIR target; your logged RIR drives the next load suggestion.', refs: ['helms-rir-2016', 'zourdos-rir-2016'], strength: 'moderate' },
  { id: 'rom', title: 'Full range, and long muscle lengths', summary: 'Full ROM generally matches or beats partial ROM; training muscles at longer lengths shows promising hypertrophy results in specific muscles.', inApp: 'Seated leg curls, overhead triceps extensions and incline curls are chosen for their lengthened positions.', refs: ['pallares-rom-2021', 'maeo-hamstrings-2021', 'maeo-triceps-2023'], strength: 'emerging' },
  { id: 'order', title: 'Important lifts first', summary: 'Exercises performed earlier in a session are performed with more strength.', inApp: 'The main lift always opens the session.', refs: ['acsm-2009'], strength: 'moderate' },
  { id: 'rest', title: 'Longer rest when performance matters', summary: 'Longer rest intervals (over ~2 minutes) favour strength performance on multi-joint lifts.', inApp: 'Main lifts rest 3–5 min, compounds 2–3 min, isolations 60–120 s.', refs: ['grgic-rest-2018'], strength: 'moderate' },
  { id: 'supersets', title: 'Supersets for compatible accessories', summary: 'Pairing non-competing exercises saves time with little cost to accessory work.', inApp: 'Only accessory pairs (e.g. leg extension + leg curl) are supersetted; main lifts never are.', refs: ['iversen-time-2021'], strength: 'practical' },
  { id: 'variation', title: 'Variation needs a reason', summary: 'Changing exercises randomly makes progress hard to measure; purposeful variation can target regions or manage fatigue.', inApp: 'Only a few accessories rotate in weeks 5–8, then the base returns for measurable progress.', refs: ['acsm-2009'], strength: 'practical' },
  { id: 'cardio', title: 'Cardio that complements lifting', summary: 'Concurrent training causes little interference with hypertrophy at moderate doses; it can blunt explosive strength more than size.', inApp: 'Low-impact Zone 2 cardio after lifting or separately, never before squats/deadlifts.', refs: ['wilson-concurrent-2012', 'schumann-concurrent-2022'], strength: 'moderate' },
  { id: 'deficit', title: 'Recovery in a calorie deficit', summary: 'An energy deficit tends to blunt lean-mass gains more than strength gains.', inApp: 'Deloads are kept and readiness check-ins can trim volume — your call, never automatic.', refs: ['murphy-deficit-2022', 'helms-prep-2014'], strength: 'moderate' },
  { id: 'protein', title: 'Protein supports muscle retention', summary: 'Adequate protein (around 1.6 g/kg/day and up) supports gains from resistance training.', inApp: 'The nutrition dashboard tracks protein remaining each day.', refs: ['morton-protein-2018', 'helms-prep-2014'], strength: 'strong' },
  { id: 'maintenance', title: 'Muscle can be maintained on less volume', summary: 'Gains are largely retained on substantially reduced volume for a period.', inApp: 'Week 11 drops accessories to maintenance volume while strength peaks.', refs: ['bickel-maintenance-2011'], strength: 'moderate' },
  { id: 'deload', title: 'Deloads and tapers', summary: 'Planned reductions in volume/intensity help manage fatigue; tapering before testing tends to improve strength expression.', inApp: 'Weeks 4 and 8 are deloads; weeks 10–11 reduce fatigue before PR week.', refs: ['bell-deload-2023', 'pritchard-taper-2015'], strength: 'moderate' },
  { id: 'steps', title: 'Daily steps', summary: 'More daily steps are associated with lower all-cause mortality, with benefits levelling off around 8,000–10,000 for under-60s.', inApp: 'Start at 8,000 and progress toward 10,000 only when adherence is good.', refs: ['paluch-steps-2022'], strength: 'strong' },
  { id: 'e1rm', title: 'Estimated 1RM is an estimate', summary: 'Rep-max equations are useful for programming but are not tested maxes.', inApp: 'e1RM uses Epley and is always labelled ESTIMATED — never called a PR.', refs: ['epley-1985'], strength: 'practical' },
  { id: 'influence', title: 'Influences, ranked honestly', summary: 'Coaches and champions provide useful practical and historical context, but their opinions do not outrank controlled research.', inApp: 'Jeff Nippard is an educational influence; Arnold is historical context. Where they differ from the evidence, the evidence wins.', refs: ['nippard', 'arnold-encyclopedia'], strength: 'practical' },
]

export const refById = new Map(REFS.map((r) => [r.id, r]))

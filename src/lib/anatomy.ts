// IV-10 v2 — real muscle anatomy for the body map.
// Every muscle is drawn as its own shape (front and back views, one side,
// mirrored for the other) and carries its textbook origin, insertion, action
// and nerve supply. Facts follow Gray's Anatomy (public-domain 1918 edition)
// and OpenStax Anatomy & Physiology 2e (CC BY 4.0), chapter 11.
// The `train` field links each real muscle to the training groups the app
// already logs sets against, so the heat map uses your real workout history.
import type { Muscle } from '@/db/types'

export type View = 'front' | 'back'
export interface AnatomyMuscle {
  id: string
  view: View
  name: string
  latin: string
  region: 'Neck' | 'Shoulder' | 'Chest' | 'Arm' | 'Forearm' | 'Core' | 'Back' | 'Hip' | 'Thigh' | 'Leg'
  origin: string
  insertion: string
  action: string
  nerve: string
  train: Muscle[]
  /** fibre direction in degrees (0 = vertical), used to draw the muscle grain */
  fibre: number
  /** one side of the body (figure's right, viewer's left); mirrored for the other side */
  d: string[]
  tip?: string
  /** deep muscle shown only in the 3D model */
  only3d?: boolean
}

/** outline of half the body (viewer's left), mirrored for the other half */
export const SILHOUETTE =
  'M100,8 C88,8 81,18 81,32 C81,44 85,54 90,60 L89,72 C80,76 66,79 56,82 C46,86 42,96 42,108 C41,122 41,140 40,156 C39,166 38,176 35,190 C32,206 30,222 29,236 C25,246 24,260 27,270 C30,278 38,278 40,268 C42,256 41,246 39,236 C44,218 50,200 54,186 C57,176 58,166 60,154 C62,142 64,134 66,128 C67,150 70,166 72,178 C70,190 66,202 64,216 C62,244 64,280 74,312 C74,328 74,346 76,362 C78,380 80,394 81,404 C79,414 77,424 79,431 L98,433 C98,424 96,414 95,404 C95,388 98,370 98,354 C98,340 96,328 96,318 C97,292 98,262 98,242 L100,236 Z'

/** bones, tendons and fascia that show through (drawn pale, not tappable) */
export const LANDMARKS: Record<View, string[]> = {
  front: [
    'M98,80 C90,79 80,80 70,82 L70,84 C80,82 90,82 98,83 Z', // clavicle
    'M99,84 L100,84 L100,134 L99,134 Z', // sternum line
    'M78,312 C78,306 82,302 86,302 C90,302 92,307 92,313 C92,320 89,326 85,326 C81,326 78,320 78,312 Z', // patella
    'M86,334 C87,356 88,380 90,400 L93,400 C92,380 91,356 90,334 Z', // shin (tibia)
    'M30,236 C26,246 25,258 28,270 C31,276 37,276 39,268 C41,258 40,246 38,236 Z', // hand
    'M82,404 C80,414 78,424 80,430 L98,432 C98,424 96,414 94,404 Z', // foot
  ],
  back: [
    'M99,60 L101,60 L101,214 L99,214 Z', // spine
    'M94,206 C96,214 98,222 100,226 L100,206 Z', // sacrum
    'M85,384 L91,384 L91,404 L86,404 Z', // achilles tendon
    'M30,236 C26,246 25,258 28,270 C31,276 37,276 39,268 C41,258 40,246 38,236 Z', // hand
    'M82,404 C80,414 78,424 80,430 L98,432 C98,424 96,414 94,404 Z', // heel / foot
    'M92,168 C88,180 86,194 88,206 L100,214 L100,166 Z', // thoracolumbar fascia
    'M68,226 C66,254 68,284 76,312 L79,312 C72,286 70,256 72,228 Z', // iliotibial band
  ],
}

export const ANATOMY: AnatomyMuscle[] = [
  // ───────────── FRONT ─────────────
  { id: 'scm', view: 'front', region: 'Neck', name: 'Sternocleidomastoid', latin: 'm. sternocleidomastoideus', fibre: -28,
    origin: 'Top of the sternum (manubrium) and inner third of the collarbone', insertion: 'Mastoid process behind the ear', action: 'Turns the head to the opposite side; both sides together bend the neck forward', nerve: 'Accessory nerve (CN XI)', train: ['traps'],
    d: ['M84,50 C86,60 92,72 97,80 L93,81 C88,72 83,62 81,53 Z'] },
  { id: 'trap-upper-f', view: 'front', region: 'Neck', name: 'Trapezius (upper)', latin: 'm. trapezius, pars descendens', fibre: 62,
    origin: 'Base of the skull and the neck ligament (ligamentum nuchae)', insertion: 'Outer third of the collarbone', action: 'Shrugs and rotates the shoulder blade upward when you raise your arms', nerve: 'Accessory nerve (CN XI)', train: ['traps'],
    d: ['M89,62 C85,70 72,77 58,82 L66,83 C76,80 85,76 92,74 Z'] },
  { id: 'delt-ant', view: 'front', region: 'Shoulder', name: 'Front deltoid', latin: 'm. deltoideus, pars clavicularis', fibre: 8,
    origin: 'Outer third of the collarbone', insertion: 'Deltoid tuberosity, halfway down the upper-arm bone', action: 'Raises the arm forward and turns it inward (front raises, overhead and incline press)', nerve: 'Axillary nerve (C5–C6)', train: ['front-delts'],
    d: ['M72,82 C64,82 59,88 57,97 C56,107 55,117 54,126 C60,118 66,106 69,96 C71,90 74,86 72,82 Z'] },
  { id: 'delt-lat', view: 'front', region: 'Shoulder', name: 'Side deltoid', latin: 'm. deltoideus, pars acromialis', fibre: 0,
    origin: 'Acromion — the bony tip of the shoulder', insertion: 'Deltoid tuberosity of the humerus', action: 'Lifts the arm out to the side — gives the shoulders their width (lateral raises)', nerve: 'Axillary nerve (C5–C6)', train: ['side-delts'],
    d: ['M69,81 C59,80 50,84 46,95 C44,107 47,119 53,128 C54,116 55,104 57,95 C60,88 64,83 69,81 Z'] },
  { id: 'pec-clav', view: 'front', region: 'Chest', name: 'Upper chest', latin: 'm. pectoralis major, pars clavicularis', fibre: 58,
    origin: 'Inner half of the collarbone', insertion: 'Outer lip of the groove on the upper-arm bone (crest of greater tubercle)', action: 'Brings the arm forward and up across the body (incline press, low-to-high flyes)', nerve: 'Lateral pectoral nerve (C5–C7)', train: ['chest'],
    d: ['M97,84 L74,85 C68,88 64,96 62,104 C72,100 86,98 98,98 Z'] },
  { id: 'pec-stern', view: 'front', region: 'Chest', name: 'Chest (sternal)', latin: 'm. pectoralis major, pars sternocostalis', fibre: 78,
    origin: 'Breastbone, upper six rib cartilages and the abdominal sheath', insertion: 'Crest of the greater tubercle of the humerus', action: 'Pulls the arm across and down the body — the main pressing muscle (bench press, dips, flyes)', nerve: 'Medial and lateral pectoral nerves (C6–T1)', train: ['chest'],
    d: ['M98,99 C86,99 72,101 62,105 C66,113 72,124 82,132 C90,135 96,134 99,132 Z'] },
  { id: 'serratus', view: 'front', region: 'Core', name: 'Serratus anterior', latin: 'm. serratus anterior', fibre: -60,
    origin: 'Outer surfaces of ribs 1–8 (the saw-tooth slips)', insertion: 'Inner edge of the shoulder blade', action: 'Pulls the shoulder blade forward around the ribs — the punch and the top of a push-up', nerve: 'Long thoracic nerve (C5–C7)', train: ['chest', 'abs'],
    d: ['M71,128 L83,133 L73,137 Z', 'M70,138 L83,142 L72,146 Z', 'M70,147 L82,150 L72,154 Z'] },
  { id: 'lat-f', view: 'front', region: 'Back', name: 'Latissimus dorsi', latin: 'm. latissimus dorsi', fibre: 20,
    origin: 'Lower six thoracic vertebrae, lower back fascia, back of the hip bone, lower ribs', insertion: 'Floor of the groove on the front of the upper-arm bone', action: 'Pulls the arm down and back — pull-ups, pulldowns, rows; the V-taper', nerve: 'Thoracodorsal nerve (C6–C8)', train: ['lats'],
    d: ['M65,112 C63,128 65,146 70,162 L73,158 C70,144 69,128 69,116 Z'] },
  { id: 'rectus-abd', view: 'front', region: 'Core', name: 'Rectus abdominis', latin: 'm. rectus abdominis', fibre: 0,
    origin: 'Pubic bone (crest and symphysis)', insertion: 'Cartilage of ribs 5–7 and the bottom of the breastbone', action: 'Curls the ribcage toward the pelvis and braces the trunk (crunches, leg raises, planks). The "six-pack" lines are tendons crossing it', nerve: 'Lower intercostal nerves (T7–T12)', train: ['abs'],
    d: ['M99,134 L88,135 C86,142 86,148 87,152 L99,152 Z', 'M99,155 L87,155 C86,162 86,168 87,172 L99,172 Z', 'M99,175 L87,175 C87,183 87,190 88,195 L99,195 Z', 'M99,198 L88,198 C89,208 93,218 99,226 Z'] },
  { id: 'ext-oblique', view: 'front', region: 'Core', name: 'External oblique', latin: 'm. obliquus externus abdominis', fibre: -38,
    origin: 'Outer surfaces of ribs 5–12', insertion: 'Iliac crest, abdominal sheath (linea alba) and pubic tubercle', action: 'Twists the trunk to the opposite side and bends it sideways (wood-chops, side planks, carries)', nerve: 'Intercostal nerves T7–T12', train: ['obliques'],
    d: ['M85,136 C79,140 74,148 72,156 C70,168 72,182 76,194 C80,204 87,214 94,222 C90,212 88,204 87,198 L86,175 L86,155 Z'] },
  { id: 'biceps', view: 'front', region: 'Arm', name: 'Biceps brachii', latin: 'm. biceps brachii', fibre: 6,
    origin: 'Two heads: coracoid process (short) and the top of the shoulder socket (long)', insertion: 'Radial tuberosity of the forearm and the bicipital aponeurosis', action: 'Bends the elbow and turns the palm up (curls, chin-ups)', nerve: 'Musculocutaneous nerve (C5–C6)', train: ['biceps'],
    d: ['M60,112 C62,126 60,146 54,164 L48,167 C45,152 46,132 50,117 C53,110 57,109 60,112 Z'] },
  { id: 'brachialis', view: 'front', region: 'Arm', name: 'Brachialis', latin: 'm. brachialis', fibre: 8,
    origin: 'Front of the lower half of the upper-arm bone', insertion: 'Coronoid process and tuberosity of the ulna', action: 'The pure elbow flexor — works in every curl, most in hammer curls', nerve: 'Musculocutaneous nerve (C5–C6)', train: ['biceps'],
    d: ['M47,128 C44,140 42,155 44,166 L48,167 C45,152 46,138 49,124 Z'] },
  { id: 'triceps-med-f', view: 'front', region: 'Arm', name: 'Triceps (inner view)', latin: 'm. triceps brachii, caput longum et mediale', fibre: 4,
    origin: 'Below the shoulder socket (long head) and the back of the humerus (medial head)', insertion: 'Olecranon — the point of the elbow', action: 'Straightens the elbow — seen here on the inside of the arm, next to the biceps (overhead extensions, dips)', nerve: 'Radial nerve (C6–C8)', train: ['triceps'],
    d: ['M62,116 C66,124 65,140 61,156 C59,162 57,166 55,168 L54,164 C59,150 62,134 61,118 Z'] },
  { id: 'brachioradialis', view: 'front', region: 'Forearm', name: 'Brachioradialis', latin: 'm. brachioradialis', fibre: 10,
    origin: 'Lower outer ridge of the upper-arm bone', insertion: 'Styloid process of the radius at the wrist', action: 'Bends the elbow with the thumb up (hammer curls, reverse curls)', nerve: 'Radial nerve (C5–C6)', train: ['forearms', 'biceps'],
    d: ['M41,168 C36,180 33,196 33,210 L31,234 L34,234 C36,214 39,196 45,180 C46,174 45,170 41,168 Z'] },
  { id: 'forearm-flex', view: 'front', region: 'Forearm', name: 'Wrist & finger flexors', latin: 'mm. flexor carpi radialis, palmaris longus, flexor digitorum superficialis, flexor carpi ulnaris', fibre: 12,
    origin: 'Inner bony bump of the elbow (medial epicondyle)', insertion: 'Bones of the wrist, palm and fingers', action: 'Close the hand and bend the wrist — your grip (deadlift holds, wrist curls, farmer carries)', nerve: 'Median and ulnar nerves (C7–T1)', train: ['forearms'],
    d: ['M45,180 C40,196 36,214 34,234 L38,236 C42,220 48,204 53,186 C55,178 54,173 51,170 C48,170 46,174 45,180 Z'] },
  { id: 'tfl', view: 'front', region: 'Hip', name: 'Tensor fasciae latae', latin: 'm. tensor fasciae latae', fibre: 10,
    origin: 'Front of the iliac crest (ASIS)', insertion: 'Iliotibial band, down to the outer knee', action: 'Lifts the leg forward and out, and steadies the pelvis when you stand on one leg', nerve: 'Superior gluteal nerve (L4–S1)', train: ['glutes', 'hip-flexors'],
    d: ['M70,196 C66,204 64,214 65,224 L72,232 C72,220 74,208 76,198 Z'] },
  { id: 'vast-lat', view: 'front', region: 'Thigh', name: 'Vastus lateralis', latin: 'm. vastus lateralis', fibre: 14,
    origin: 'Greater trochanter and outer ridge of the thigh bone (linea aspera)', insertion: 'Kneecap, then the shin through the patellar tendon', action: 'Straightens the knee — the outer sweep of the thigh (squats, leg press)', nerve: 'Femoral nerve (L2–L4)', train: ['quads'],
    d: ['M66,222 C62,246 63,278 70,306 L79,311 C73,290 70,262 72,232 Z'] },
  { id: 'rect-fem', view: 'front', region: 'Thigh', name: 'Rectus femoris', latin: 'm. rectus femoris', fibre: 0,
    origin: 'Front of the hip bone (AIIS) and above the hip socket', insertion: 'Kneecap, then the shin through the patellar tendon', action: 'Straightens the knee and lifts the thigh — the only quad that crosses the hip (leg extensions, sissy squats)', nerve: 'Femoral nerve (L2–L4)', train: ['quads', 'hip-flexors'],
    d: ['M72,214 C68,240 70,274 78,300 L86,302 C88,286 86,262 82,240 C80,228 78,218 76,212 Z'] },
  { id: 'vast-med', view: 'front', region: 'Thigh', name: 'Vastus medialis', latin: 'm. vastus medialis', fibre: -30,
    origin: 'Inner ridge of the thigh bone', insertion: 'Inner edge of the kneecap', action: 'Straightens the knee and keeps the kneecap tracking — the "teardrop" (deep squats, split squats)', nerve: 'Femoral nerve (L2–L4)', train: ['quads'],
    d: ['M86,270 C92,282 96,296 94,312 C90,318 84,316 82,308 C84,296 84,282 86,270 Z'] },
  { id: 'adductors', view: 'front', region: 'Thigh', name: 'Adductors', latin: 'mm. adductor longus, brevis, magnus; gracilis; pectineus', fibre: 22,
    origin: 'Pubic bone and the bottom of the pelvis', insertion: 'Inner ridge of the thigh bone (gracilis to the inner shin)', action: 'Pull the legs together and help extend the hip (sumo squats, Copenhagen planks, adductor machine)', nerve: 'Obturator nerve (L2–L4)', train: ['quads', 'glutes'],
    d: ['M98,234 C92,236 86,236 82,226 C84,248 88,270 92,290 C95,272 97,252 98,234 Z'] },
  { id: 'sartorius', view: 'front', region: 'Thigh', name: 'Sartorius', latin: 'm. sartorius', fibre: -14,
    origin: 'Front point of the hip bone (ASIS)', insertion: 'Inner upper shin (pes anserinus)', action: 'Bends hip and knee and turns the thigh out — the longest muscle in the body (sitting cross-legged)', nerve: 'Femoral nerve (L2–L3)', train: ['quads', 'hip-flexors'],
    d: ['M76,196 L80,197 C84,230 90,270 95,318 L92,322 C86,276 80,232 76,196 Z'] },
  { id: 'tib-ant', view: 'front', region: 'Leg', name: 'Tibialis anterior', latin: 'm. tibialis anterior', fibre: 4,
    origin: 'Outer upper two-thirds of the shin bone', insertion: 'Inner foot (first metatarsal and cuneiform)', action: 'Pulls the toes up and turns the foot in — protects the shins when running (tib raises)', nerve: 'Deep fibular nerve (L4–L5)', train: ['calves'],
    d: ['M80,330 C77,350 78,372 84,396 L87,396 C86,372 86,350 86,332 Z'] },
  { id: 'peroneus', view: 'front', region: 'Leg', name: 'Fibularis (peroneus) longus', latin: 'm. fibularis longus', fibre: 4,
    origin: 'Head and upper outer fibula', insertion: 'Under the foot (first metatarsal and cuneiform)', action: 'Points the foot and rolls it outward — steadies the ankle', nerve: 'Superficial fibular nerve (L5–S1)', train: ['calves'],
    d: ['M77,334 C74,352 75,372 80,392 L82,392 C79,372 78,352 80,334 Z'] },
  { id: 'gastroc-f', view: 'front', region: 'Leg', name: 'Gastrocnemius (inner head)', latin: 'm. gastrocnemius, caput mediale', fibre: 0,
    origin: 'Inner condyle of the thigh bone, just above the knee', insertion: 'Heel bone through the Achilles tendon', action: 'Points the foot and helps bend the knee (standing calf raises, sprinting)', nerve: 'Tibial nerve (S1–S2)', train: ['calves'],
    d: ['M92,330 C98,342 99,362 96,380 L92,376 C93,360 92,344 90,334 Z'] },

  // ───────────── BACK ─────────────
  { id: 'trap', view: 'back', region: 'Back', name: 'Trapezius', latin: 'm. trapezius', fibre: 55,
    origin: 'Base of the skull, neck ligament and the spines of C7–T12', insertion: 'Outer collarbone, acromion and the spine of the shoulder blade', action: 'Upper fibres shrug, middle fibres squeeze the shoulder blades together, lower fibres pull them down (shrugs, rows, face pulls, Y-raises)', nerve: 'Accessory nerve (CN XI), C3–C4', train: ['traps', 'upper-back'],
    d: ['M100,46 C96,56 92,64 88,70 C80,76 68,80 58,84 C64,90 72,96 78,104 C84,124 92,148 100,172 Z'] },
  { id: 'delt-post', view: 'back', region: 'Shoulder', name: 'Rear deltoid', latin: 'm. deltoideus, pars spinalis', fibre: -10,
    origin: 'Spine of the shoulder blade', insertion: 'Deltoid tuberosity of the humerus', action: 'Pulls the arm back and turns it out (reverse flyes, face pulls, wide rows)', nerve: 'Axillary nerve (C5–C6)', train: ['rear-delts'],
    d: ['M58,84 C51,87 47,96 47,108 C48,118 51,125 54,130 C58,118 64,104 72,96 C68,90 63,86 58,84 Z'] },
  { id: 'delt-lat-b', view: 'back', region: 'Shoulder', name: 'Side deltoid', latin: 'm. deltoideus, pars acromialis', fibre: 0,
    origin: 'Acromion', insertion: 'Deltoid tuberosity of the humerus', action: 'Lifts the arm out to the side (lateral raises)', nerve: 'Axillary nerve (C5–C6)', train: ['side-delts'],
    d: ['M51,86 C45,92 43,102 44,112 L48,120 C47,106 49,96 55,88 Z'] },
  { id: 'infraspinatus', view: 'back', region: 'Back', name: 'Infraspinatus & teres minor', latin: 'mm. infraspinatus, teres minor', fibre: 70,
    origin: 'Back of the shoulder blade below its spine', insertion: 'Greater tubercle of the humerus', action: 'Rotator cuff — turns the arm outward and keeps the shoulder joint centred (external rotations, face pulls)', nerve: 'Suprascapular (C5–C6) and axillary nerves', train: ['upper-back', 'rear-delts'],
    d: ['M78,104 C70,108 64,116 64,126 C70,132 80,134 88,132 C88,122 84,110 78,104 Z'] },
  { id: 'teres-major', view: 'back', region: 'Back', name: 'Teres major', latin: 'm. teres major', fibre: 65,
    origin: 'Lower corner of the shoulder blade', insertion: 'Inner lip of the groove on the humerus (next to the lats)', action: '"Lat\'s little helper" — pulls the arm down, back and in (pull-ups, rows)', nerve: 'Lower subscapular nerve (C5–C7)', train: ['lats', 'upper-back'],
    d: ['M64,128 C61,134 62,140 66,144 C72,142 80,138 86,134 L84,132 C76,134 70,132 64,128 Z'] },
  { id: 'lat', view: 'back', region: 'Back', name: 'Latissimus dorsi', latin: 'm. latissimus dorsi', fibre: 30,
    origin: 'Spines of T7–L5, thoracolumbar fascia, iliac crest and lower 3–4 ribs', insertion: 'Floor of the intertubercular groove of the humerus', action: 'Pulls the arm down, back and in — the widest muscle of the back (pull-ups, pulldowns, rows)', nerve: 'Thoracodorsal nerve (C6–C8)', train: ['lats'],
    d: ['M66,144 C64,156 66,172 72,186 C80,196 90,200 100,202 L100,174 C94,160 90,150 86,136 C80,140 72,144 66,144 Z'] },
  { id: 'rhomboids', view: 'back', region: 'Back', name: 'Rhomboids', latin: 'mm. rhomboideus major et minor', fibre: 60, only3d: true,
    origin: 'Spines of C7–T5', insertion: 'Inner edge of the shoulder blade', action: 'Squeeze the shoulder blades together and down — under the trapezius (rows, face pulls, band pull-aparts)', nerve: 'Dorsal scapular nerve (C4–C5)', train: ['upper-back'], d: [] },
  { id: 'supraspinatus', view: 'back', region: 'Back', name: 'Supraspinatus', latin: 'm. supraspinatus', fibre: 80, only3d: true,
    origin: 'Hollow of the shoulder blade above its spine', insertion: 'Top of the greater tubercle of the humerus', action: 'Rotator cuff — starts lifting the arm out to the side and holds the ball in the socket (scaption, light raises)', nerve: 'Suprascapular nerve (C5–C6)', train: ['side-delts', 'upper-back'], d: [] },
  { id: 'levator-scap', view: 'back', region: 'Neck', name: 'Levator scapulae', latin: 'm. levator scapulae', fibre: -15, only3d: true,
    origin: 'Side of the top four neck vertebrae (C1–C4)', insertion: 'Upper inner corner of the shoulder blade', action: 'Lifts the shoulder blade and tilts the neck — often the "knot" in a stiff neck (shrugs)', nerve: 'Dorsal scapular nerve and C3–C4', train: ['traps'], d: [] },
  { id: 'erector', view: 'back', region: 'Back', name: 'Erector spinae', latin: 'mm. iliocostalis, longissimus, spinalis', fibre: 0,
    origin: 'Sacrum, iliac crest and the lower vertebrae', insertion: 'Ribs, vertebrae and the base of the skull', action: 'Keeps the spine straight under load and arches it back (deadlifts, back extensions, good mornings)', nerve: 'Dorsal rami of the spinal nerves', train: ['lower-back'],
    d: ['M99,166 L93,166 C91,180 91,196 93,210 L99,214 Z'] },
  { id: 'oblique-b', view: 'back', region: 'Core', name: 'External oblique', latin: 'm. obliquus externus abdominis', fibre: -30,
    origin: 'Outer surfaces of ribs 5–12', insertion: 'Iliac crest and abdominal sheath', action: 'Twists and side-bends the trunk', nerve: 'Intercostal nerves T7–T12', train: ['obliques'],
    d: ['M66,150 C64,168 66,184 70,194 L74,190 C70,178 68,164 68,150 Z'] },
  { id: 'glute-med', view: 'back', region: 'Hip', name: 'Gluteus medius', latin: 'm. gluteus medius', fibre: 20,
    origin: 'Outer surface of the hip bone, below the iliac crest', insertion: 'Greater trochanter of the thigh bone', action: 'Lifts the leg out to the side and keeps the pelvis level on one leg (side-lying raises, single-leg work, banded walks)', nerve: 'Superior gluteal nerve (L4–S1)', train: ['glutes'],
    d: ['M72,190 C66,196 64,206 66,214 C74,212 84,206 90,200 C84,196 78,192 72,190 Z'] },
  { id: 'glute-max', view: 'back', region: 'Hip', name: 'Gluteus maximus', latin: 'm. gluteus maximus', fibre: 50,
    origin: 'Back of the hip bone, sacrum, coccyx and lower back fascia', insertion: 'Iliotibial band and the gluteal tuberosity of the thigh bone', action: 'Drives the hip forward (extension) — the biggest muscle in the body (hip thrusts, squats, RDLs)', nerve: 'Inferior gluteal nerve (L5–S2)', train: ['glutes'],
    d: ['M90,200 C80,206 70,212 66,220 C64,232 68,244 78,250 C88,252 96,248 100,244 L100,206 C96,204 93,202 90,200 Z'] },
  { id: 'triceps-lat', view: 'back', region: 'Arm', name: 'Triceps (lateral head)', latin: 'm. triceps brachii, caput laterale', fibre: 4,
    origin: 'Back of the humerus above the radial groove', insertion: 'Olecranon — the point of the elbow', action: 'Straightens the elbow — the horseshoe on the outer arm (pushdowns, close-grip bench)', nerve: 'Radial nerve (C6–C8)', train: ['triceps'],
    d: ['M50,118 C45,128 42,142 42,156 L46,160 C47,146 50,132 54,122 Z'] },
  { id: 'triceps-long', view: 'back', region: 'Arm', name: 'Triceps (long head)', latin: 'm. triceps brachii, caput longum', fibre: 2,
    origin: 'Just below the shoulder socket (infraglenoid tubercle of the scapula)', insertion: 'Olecranon of the ulna', action: 'Straightens the elbow and pulls the arm back — the biggest triceps head, trained best with the arm overhead', nerve: 'Radial nerve (C6–C8)', train: ['triceps'],
    d: ['M54,122 C50,134 48,148 47,160 L52,164 C58,152 62,138 64,128 C61,122 57,119 54,122 Z'] },
  { id: 'forearm-ext', view: 'back', region: 'Forearm', name: 'Wrist & finger extensors', latin: 'mm. extensor carpi radialis, extensor digitorum, extensor carpi ulnaris', fibre: 10,
    origin: 'Outer bony bump of the elbow (lateral epicondyle)', insertion: 'Back of the hand and fingers', action: 'Open the hand and pull the wrist back — balances grip (reverse curls, wrist extensions)', nerve: 'Radial nerve (posterior interosseous, C7–C8)', train: ['forearms'],
    d: ['M44,168 C38,184 34,204 32,234 L37,236 C40,214 45,194 51,176 C50,170 47,167 44,168 Z'] },
  { id: 'fcu', view: 'back', region: 'Forearm', name: 'Flexor carpi ulnaris', latin: 'm. flexor carpi ulnaris', fibre: 12,
    origin: 'Inner elbow and the back edge of the ulna', insertion: 'Pisiform bone and fifth metacarpal (little-finger side of the wrist)', action: 'Bends the wrist toward the little finger — a strong part of grip', nerve: 'Ulnar nerve (C7–T1)', train: ['forearms'],
    d: ['M51,176 C46,194 41,214 37,236 L39,236 C44,216 50,198 54,182 Z'] },
  { id: 'biceps-fem', view: 'back', region: 'Thigh', name: 'Biceps femoris', latin: 'm. biceps femoris', fibre: -8,
    origin: 'Sitting bone (ischial tuberosity) and the back of the thigh bone', insertion: 'Head of the fibula, outside the knee', action: 'Bends the knee and extends the hip — the outer hamstring (RDLs, leg curls, Nordic curls)', nerve: 'Sciatic nerve — tibial and common fibular parts (L5–S2)', train: ['hamstrings'],
    d: ['M80,250 C72,268 70,290 74,312 L80,316 C80,294 82,272 86,252 Z'] },
  { id: 'semis', view: 'back', region: 'Thigh', name: 'Semitendinosus & semimembranosus', latin: 'mm. semitendinosus, semimembranosus', fibre: 6,
    origin: 'Sitting bone (ischial tuberosity)', insertion: 'Inner upper shin (pes anserinus and medial tibial condyle)', action: 'Bend the knee, extend the hip and turn the shin in — the inner hamstrings (leg curls, good mornings)', nerve: 'Sciatic nerve, tibial part (L5–S2)', train: ['hamstrings'],
    d: ['M86,252 C84,274 84,296 88,316 L94,316 C96,294 97,270 97,250 C93,248 89,250 86,252 Z'] },
  { id: 'gastroc-lat', view: 'back', region: 'Leg', name: 'Gastrocnemius (outer head)', latin: 'm. gastrocnemius, caput laterale', fibre: 0,
    origin: 'Outer condyle of the thigh bone', insertion: 'Heel bone via the Achilles tendon', action: 'Points the foot with the knee straight (standing calf raises, jumping)', nerve: 'Tibial nerve (S1–S2)', train: ['calves'],
    d: ['M78,326 C74,340 74,356 78,372 L86,370 C86,354 86,338 85,324 Z'] },
  { id: 'gastroc-med', view: 'back', region: 'Leg', name: 'Gastrocnemius (inner head)', latin: 'm. gastrocnemius, caput mediale', fibre: 0,
    origin: 'Inner condyle of the thigh bone', insertion: 'Heel bone via the Achilles tendon', action: 'Points the foot and helps bend the knee — the bigger, lower head', nerve: 'Tibial nerve (S1–S2)', train: ['calves'],
    d: ['M86,324 C87,340 87,358 87,376 L94,374 C98,360 98,342 95,326 Z'] },
  { id: 'soleus', view: 'back', region: 'Leg', name: 'Soleus', latin: 'm. soleus', fibre: 0,
    origin: 'Back of the upper tibia and fibula', insertion: 'Heel bone via the Achilles tendon', action: 'Points the foot when the knee is bent — your posture and walking muscle (seated calf raises)', nerve: 'Tibial nerve (S1–S2)', train: ['calves'],
    d: ['M78,372 C78,384 80,394 84,400 L92,400 C94,392 95,382 94,374 L87,378 L86,370 Z'] },
]

export const anatomyById = (id: string) => ANATOMY.find((m) => m.id === id)

/** hard sets for a real muscle = the highest of the training groups it belongs to */
export function anatomySets(byMuscle: Map<Muscle, number>, m: AnatomyMuscle): number {
  return Math.max(0, ...m.train.map((t) => byMuscle.get(t) ?? 0))
}

/** training heat colours (same scale as everywhere else in the app) */
export function heatHex(sets: number): string {
  return sets === 0 ? '#3b4a5e' : sets < 6 ? '#b7791f' : sets < 10 ? '#eab308' : sets <= 20 ? '#22c55e' : '#ef4444'
}

/** search by common name, latin name, region or training group */
export function searchAnatomy(q: string): AnatomyMuscle[] {
  const s = q.trim().toLowerCase()
  if (!s) return []
  return ANATOMY.filter((m) => [m.name, m.latin, m.region, ...m.train].join(' ').toLowerCase().includes(s))
}

/** quiz: pick a random muscle (not the last one) */
export function quizPick(prev?: string, rnd: () => number = Math.random): AnatomyMuscle {
  const pool = ANATOMY.filter((m) => m.id !== prev)
  return pool[Math.floor(rnd() * pool.length) % pool.length]
}

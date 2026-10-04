import {
  ArrowRight,
  BookOpen,
  Calendar,
  Car,
  Clock,
  CreditCard,
  FileText,
  Hospital,
  House,
  IdCard,
  Info,
  LogIn,
  MapPin,
  MessageCircle,
  Newspaper,
  Package,
  Pill,
  Receipt,
  Search,
  ShieldCheck,
  Stethoscope,
  Wallet,
  type LucideIcon,
} from "lucide-react";

// First match wins, so specific tasks come before broad words like "plan" or "find".
const RULES: [RegExp, LucideIcon][] = [
  [/claim/i, Receipt],
  [/\bid card|member card|insurance card/i, IdCard],
  [/doctor|provider|physician|specialist|dentist|therapist/i, Stethoscope],
  [/pharm|prescri|\bdrugs?\b|medicine|medication|refill/i, Pill],
  [/hospital|urgent care|clinic|emergency/i, Hospital],
  [/\bbill|\bpay\b|payment|premium|invoice|\bfine\b/i, CreditCard],
  [/sign in|log ?in|account|register|portal/i, LogIn],
  [/contact|support|help|chat|\bcall\b|phone/i, MessageCircle],
  [/\bcar\b|auto|vehicle/i, Car],
  [/\bhome\b|house|renter|property/i, House],
  [/quote|estimate|price|cost/i, Wallet],
  [/benefit|coverage|\bplans?\b|policy|policies|insur/i, ShieldCheck],
  [/location|near you|near me|\bmap\b|direction|office|branch/i, MapPin],
  [/hours|schedule/i, Clock],
  [/event|calendar|appointment|\bbook (a|an)\b/i, Calendar],
  [/order|track|ship|deliver/i, Package],
  [/form|document|apply|application/i, FileText],
  [/news|article|blog/i, Newspaper],
  [/library|catalog|books?\b|read/i, BookOpen],
  [/search|find|look up/i, Search],
  [/learn|about|info/i, Info],
];

/** Picks a recognizable icon for a task from its label; the label itself always stays visible. */
export function taskIcon(label: string): LucideIcon {
  const task = label.replace(/\(sign in first\)\s*$/i, "");
  return RULES.find(([pattern]) => pattern.test(task))?.[1] ?? ArrowRight;
}

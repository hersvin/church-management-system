/**
 * The app's icon set, backed by Rune Icons (runeicons-react).
 *
 * Rune components only accept `size`. Every icon here is wrapped so it also
 * accepts `className` and `aria-label`, renders a bare <svg> (so shadcn's
 * `[&_svg]:size-4` rules keep working), and is hidden from screen readers
 * unless labelled. Import icons from this module, never from runeicons-react
 * directly, so the whole app stays on one icon style.
 *
 * Per-icon subpath imports keep the dev server from loading all 1,800 icons.
 */
import { cloneElement, type ReactElement, type SVGProps } from "react";
import { Archive } from "runeicons-react/icons/Archive";
import { ArrowLeft } from "runeicons-react/icons/ArrowLeft";
import { BookBookmark } from "runeicons-react/icons/BookBookmark";
import { Box } from "runeicons-react/icons/Box";
import { Calendar } from "runeicons-react/icons/Calendar";
import { ChartBar } from "runeicons-react/icons/ChartBar";
import { Check } from "runeicons-react/icons/Check";
import { ChevronDown } from "runeicons-react/icons/ChevronDown";
import { ChevronLeft } from "runeicons-react/icons/ChevronLeft";
import { ChevronRight } from "runeicons-react/icons/ChevronRight";
import { CircleCheck } from "runeicons-react/icons/CircleCheck";
import { CircleX } from "runeicons-react/icons/CircleX";
import { ClipboardList } from "runeicons-react/icons/ClipboardList";
import { Clock } from "runeicons-react/icons/Clock";
import { Gift } from "runeicons-react/icons/Gift";
import { Globe } from "runeicons-react/icons/Globe";
import { Group } from "runeicons-react/icons/Group";
import { Hand } from "runeicons-react/icons/Hand";
import { Heart } from "runeicons-react/icons/Heart";
import { History } from "runeicons-react/icons/History";
import { House } from "runeicons-react/icons/House";
import { Info } from "runeicons-react/icons/Info";
import { LayoutGrid } from "runeicons-react/icons/LayoutGrid";
import { LogOut } from "runeicons-react/icons/LogOut";
import { Map as MapGlyph } from "runeicons-react/icons/Map";
import { MapPin } from "runeicons-react/icons/MapPin";
import { Lock } from "runeicons-react/icons/Lock";
import { LockOpen } from "runeicons-react/icons/LockOpen";
import { LogIn } from "runeicons-react/icons/LogIn";
import { Mic } from "runeicons-react/icons/Mic";
import { PanelLeft } from "runeicons-react/icons/PanelLeft";
import { Pause } from "runeicons-react/icons/Pause";
import { Pencil } from "runeicons-react/icons/Pencil";
import { Phone } from "runeicons-react/icons/Phone";
import { Play } from "runeicons-react/icons/Play";
import { Plus } from "runeicons-react/icons/Plus";
import { Puzzle } from "runeicons-react/icons/Puzzle";
import { Printer } from "runeicons-react/icons/Printer";
import { ArrowDownToLine } from "runeicons-react/icons/ArrowDownToLine";
import { Image as ImageGlyph } from "runeicons-react/icons/Image";
import { Mail } from "runeicons-react/icons/Mail";
import { Grid2x2 } from "runeicons-react/icons/Grid2x2";
import { Repeat } from "runeicons-react/icons/Repeat";
import { RotateCw } from "runeicons-react/icons/RotateCw";
import { Search } from "runeicons-react/icons/Search";
import { Settings } from "runeicons-react/icons/Settings";
import { ShieldCheck } from "runeicons-react/icons/ShieldCheck";
import { Sparkles } from "runeicons-react/icons/Sparkles";
import { Tag } from "runeicons-react/icons/Tag";
import { Trash } from "runeicons-react/icons/Trash";
import { TriangleAlert } from "runeicons-react/icons/TriangleAlert";
import { UserCog } from "runeicons-react/icons/UserCog";
import { UserMinus } from "runeicons-react/icons/UserMinus";
import { UserPlus } from "runeicons-react/icons/UserPlus";
import { Users } from "runeicons-react/icons/Users";
import { Video } from "runeicons-react/icons/Video";
import { X } from "runeicons-react/icons/X";

type RuneComponent = (props: { size?: number }) => ReactElement;

export interface AppIconProps {
  className?: string;
  /** Pixel size before CSS. Tailwind size classes override it. */
  size?: number;
  /** Set only when the icon carries meaning on its own (no visible text). */
  "aria-label"?: string;
}

export type AppIcon = ((props: AppIconProps) => ReactElement) & { displayName?: string };

function fromRune(Rune: RuneComponent, name: string): AppIcon {
  function Icon({ className, size = 24, "aria-label": label }: AppIconProps) {
    // Rune components are hook-free render functions (see the package README),
    // so calling one returns its <svg> element, which we extend with our props.
    const svg = Rune({ size }) as ReactElement<SVGProps<SVGSVGElement> & { "data-icon"?: string }>;
    return cloneElement(svg, {
      className,
      focusable: "false",
      "data-icon": name,
      ...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true }),
    });
  }
  Icon.displayName = `${name}Icon`;
  return Icon;
}

export const ArchiveIcon = fromRune(Archive, "Archive");
export const ArrowLeftIcon = fromRune(ArrowLeft, "ArrowLeft");
export const BookBookmarkIcon = fromRune(BookBookmark, "BookBookmark");
export const BoxIcon = fromRune(Box, "Box");
export const CalendarIcon = fromRune(Calendar, "Calendar");
export const ChartBarIcon = fromRune(ChartBar, "ChartBar");
export const CheckIcon = fromRune(Check, "Check");
export const ChevronDownIcon = fromRune(ChevronDown, "ChevronDown");
export const ChevronLeftIcon = fromRune(ChevronLeft, "ChevronLeft");
export const ChevronRightIcon = fromRune(ChevronRight, "ChevronRight");
export const CircleCheckIcon = fromRune(CircleCheck, "CircleCheck");
export const CircleXIcon = fromRune(CircleX, "CircleX");
export const ClipboardListIcon = fromRune(ClipboardList, "ClipboardList");
export const ClockIcon = fromRune(Clock, "Clock");
export const GiftIcon = fromRune(Gift, "Gift");
export const GlobeIcon = fromRune(Globe, "Globe");
export const GroupIcon = fromRune(Group, "Group");
export const HandIcon = fromRune(Hand, "Hand");
export const HeartIcon = fromRune(Heart, "Heart");
export const HistoryIcon = fromRune(History, "History");
export const HouseIcon = fromRune(House, "House");
export const InfoIcon = fromRune(Info, "Info");
export const LayoutGridIcon = fromRune(LayoutGrid, "LayoutGrid");
export const LockIcon = fromRune(Lock, "Lock");
export const LockOpenIcon = fromRune(LockOpen, "LockOpen");
export const LogInIcon = fromRune(LogIn, "LogIn");
export const LogOutIcon = fromRune(LogOut, "LogOut");
export const MapIcon = fromRune(MapGlyph, "Map");
export const MapPinIcon = fromRune(MapPin, "MapPin");
export const MicIcon = fromRune(Mic, "Mic");
export const PanelLeftIcon = fromRune(PanelLeft, "PanelLeft");
export const PauseIcon = fromRune(Pause, "Pause");
export const PencilIcon = fromRune(Pencil, "Pencil");
export const PhoneIcon = fromRune(Phone, "Phone");
export const PlayIcon = fromRune(Play, "Play");
export const PlusIcon = fromRune(Plus, "Plus");
export const PuzzleIcon = fromRune(Puzzle, "Puzzle");
export const PrinterIcon = fromRune(Printer, "Printer");
export const DownloadIcon = fromRune(ArrowDownToLine, "ArrowDownToLine");
export const ImageIcon = fromRune(ImageGlyph, "Image");
export const MailIcon = fromRune(Mail, "Mail");
/** Rune has no QR glyph; a 2x2 grid stands in for "QR code". */
export const QrCodeIcon = fromRune(Grid2x2, "Grid2x2");
export const RepeatIcon = fromRune(Repeat, "Repeat");
export const RotateCwIcon = fromRune(RotateCw, "RotateCw");
export const SearchIcon = fromRune(Search, "Search");
export const SettingsIcon = fromRune(Settings, "Settings");
export const ShieldCheckIcon = fromRune(ShieldCheck, "ShieldCheck");
export const SparklesIcon = fromRune(Sparkles, "Sparkles");
export const TagIcon = fromRune(Tag, "Tag");
export const TrashIcon = fromRune(Trash, "Trash");
export const TriangleAlertIcon = fromRune(TriangleAlert, "TriangleAlert");
export const UserCogIcon = fromRune(UserCog, "UserCog");
export const UserMinusIcon = fromRune(UserMinus, "UserMinus");
export const UserPlusIcon = fromRune(UserPlus, "UserPlus");
export const UsersIcon = fromRune(Users, "Users");
export const VideoIcon = fromRune(Video, "Video");
export const XIcon = fromRune(X, "X");

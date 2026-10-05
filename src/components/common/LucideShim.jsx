import React from 'react';

const ICON_MAP = {
  ArrowLeft: 'arrow_back',
  ArrowRight: 'arrow_forward',
  ChevronLeft: 'chevron_left',
  ChevronRight: 'chevron_right',
  FileSpreadsheet: 'table_chart',
  CheckCircle2: 'check_circle',
  FileText: 'description',
  BarChart3: 'bar_chart',
  Save: 'save',
  Loader2: 'progress_activity',
  Building2: 'domain',
  UploadCloud: 'cloud_upload',
  X: 'close',
  Image: 'image',
  ImageIcon: 'image',
  AlertCircle: 'error',
  Check: 'check',
  AlertOctagon: 'report_problem',
  AlertTriangle: 'warning',
  XCircle: 'cancel',
  HelpCircle: 'help',
  Download: 'download',
  Clock: 'schedule',
  Search: 'search',
  Filter: 'filter_list',
  Tag: 'label',
  TagIcon: 'label',
  Plus: 'add',
  MapPin: 'location_on',
  Navigation: 'near_me',
  RefreshCw: 'refresh',
  ShieldAlert: 'shield',
  Edit2: 'edit',
  Trash2: 'delete',
  Eye: 'visibility',
  DollarSign: 'attach_money',
  Train: 'train',
  Star: 'star',
  ExternalLink: 'open_in_new',
};

function createIcon(materialIconName) {
  return function MaterialIcon({ className = '', style, ...props }) {
    const isSpinning = className.includes('animate-spin');
    return (
      <span
        className={`material-symbols-outlined select-none inline-block align-middle ${isSpinning ? 'animate-spin' : ''} ${className}`}
        style={{ fontSize: '1.25em', ...style }}
        {...props}
      >
        {materialIconName}
      </span>
    );
  };
}

export const ArrowLeft = createIcon(ICON_MAP.ArrowLeft);
export const ArrowRight = createIcon(ICON_MAP.ArrowRight);
export const ChevronLeft = createIcon(ICON_MAP.ChevronLeft);
export const ChevronRight = createIcon(ICON_MAP.ChevronRight);
export const FileSpreadsheet = createIcon(ICON_MAP.FileSpreadsheet);
export const CheckCircle2 = createIcon(ICON_MAP.CheckCircle2);
export const FileText = createIcon(ICON_MAP.FileText);
export const BarChart3 = createIcon(ICON_MAP.BarChart3);
export const Save = createIcon(ICON_MAP.Save);
export const Loader2 = createIcon(ICON_MAP.Loader2);
export const Building2 = createIcon(ICON_MAP.Building2);
export const UploadCloud = createIcon(ICON_MAP.UploadCloud);
export const X = createIcon(ICON_MAP.X);
export const Image = createIcon(ICON_MAP.Image);
export const ImageIcon = createIcon(ICON_MAP.ImageIcon);
export const AlertCircle = createIcon(ICON_MAP.AlertCircle);
export const Check = createIcon(ICON_MAP.Check);
export const AlertOctagon = createIcon(ICON_MAP.AlertOctagon);
export const AlertTriangle = createIcon(ICON_MAP.AlertTriangle);
export const XCircle = createIcon(ICON_MAP.XCircle);
export const HelpCircle = createIcon(ICON_MAP.HelpCircle);
export const Download = createIcon(ICON_MAP.Download);
export const Clock = createIcon(ICON_MAP.Clock);
export const Search = createIcon(ICON_MAP.Search);
export const Filter = createIcon(ICON_MAP.Filter);
export const Tag = createIcon(ICON_MAP.Tag);
export const TagIcon = createIcon(ICON_MAP.TagIcon);
export const Plus = createIcon(ICON_MAP.Plus);
export const MapPin = createIcon(ICON_MAP.MapPin);
export const Navigation = createIcon(ICON_MAP.Navigation);
export const RefreshCw = createIcon(ICON_MAP.RefreshCw);
export const ShieldAlert = createIcon(ICON_MAP.ShieldAlert);
export const Edit2 = createIcon(ICON_MAP.Edit2);
export const Trash2 = createIcon(ICON_MAP.Trash2);
export const Eye = createIcon(ICON_MAP.Eye);
export const DollarSign = createIcon(ICON_MAP.DollarSign);
export const Train = createIcon(ICON_MAP.Train);
export const Star = createIcon(ICON_MAP.Star);
export const ExternalLink = createIcon(ICON_MAP.ExternalLink);

export default createIcon('info');

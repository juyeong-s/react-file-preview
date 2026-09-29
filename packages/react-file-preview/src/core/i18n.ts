export interface Messages {
  loading: string;
  errorTitle: string;
  retry: string;
  unsupportedTitle: string;
  unsupportedDescription: string;
  mediaError: string;
  download: string;
  print: string;
  zoomIn: string;
  zoomOut: string;
  zoomLevel: string;
  fitPage: string;
  fitWidth: string;
  prevPage: string;
  nextPage: string;
  page: string;
  rotateCw: string;
  rotateCcw: string;
  thumbnails: string;
  toggleSidebar: string;
  sheets: string;
  passwordTitle: string;
  passwordDescription: string;
  passwordIncorrect: string;
  passwordPlaceholder: string;
  passwordSubmit: string;
}

export const en: Messages = {
  loading: 'Loading…',
  errorTitle: 'Could not open this file',
  retry: 'Try again',
  unsupportedTitle: 'Preview not available',
  unsupportedDescription: 'This file type cannot be previewed. You can download it instead.',
  mediaError: 'This browser cannot play this file.',
  download: 'Download',
  print: 'Print',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  zoomLevel: 'Zoom level',
  fitPage: 'Fit page',
  fitWidth: 'Fit width',
  prevPage: 'Previous page',
  nextPage: 'Next page',
  page: 'Page',
  rotateCw: 'Rotate clockwise',
  rotateCcw: 'Rotate counterclockwise',
  thumbnails: 'Thumbnails',
  toggleSidebar: 'Toggle sidebar',
  sheets: 'Sheets',
  passwordTitle: 'Password required',
  passwordDescription: 'This document is protected. Enter its password to open it.',
  passwordIncorrect: 'Incorrect password. Please try again.',
  passwordPlaceholder: 'Password',
  passwordSubmit: 'Open',
};

export const ko: Messages = {
  loading: '불러오는 중…',
  errorTitle: '파일을 열 수 없습니다',
  retry: '다시 시도',
  unsupportedTitle: '미리보기를 지원하지 않는 파일입니다',
  unsupportedDescription: '이 형식은 미리 볼 수 없습니다. 파일을 내려받아 확인해 주세요.',
  mediaError: '이 브라우저에서 재생할 수 없는 파일입니다.',
  download: '다운로드',
  print: '인쇄',
  zoomIn: '확대',
  zoomOut: '축소',
  zoomLevel: '배율',
  fitPage: '페이지 맞춤',
  fitWidth: '너비 맞춤',
  prevPage: '이전 페이지',
  nextPage: '다음 페이지',
  page: '페이지',
  rotateCw: '시계 방향 회전',
  rotateCcw: '반시계 방향 회전',
  thumbnails: '썸네일',
  toggleSidebar: '사이드바 열기/닫기',
  sheets: '시트',
  passwordTitle: '비밀번호가 필요합니다',
  passwordDescription: '보호된 문서입니다. 비밀번호를 입력해 주세요.',
  passwordIncorrect: '비밀번호가 올바르지 않습니다. 다시 입력해 주세요.',
  passwordPlaceholder: '비밀번호',
  passwordSubmit: '열기',
};

export const locales = { en, ko };

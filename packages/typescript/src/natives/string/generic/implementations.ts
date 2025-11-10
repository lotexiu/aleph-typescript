function toKebabCase(str: string): string {
  return str.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? "-" : "") + $.toLowerCase());
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function capitalizeAll(str: string, splitStr: string): string {
  return str.split(splitStr).map((strPart: string): string => capitalize(strPart)).join(splitStr);
}

function rightPad(str: string, padChar: string, length: number): string {
  return str + padChar.repeat(length - str.length);
}

function leftPad(str: string, padChar: string, length: number): string {
  return padChar.repeat(length - str.length) + str;
}

function getFirstDifferentIndex(str1: string, str2: string, defaultValue: number = -1): number {
  let index: number = [...str1].findIndex((char, index) => {
    return str2[index] !== char;
  });
  return index === -1 ? defaultValue : index;
}

function getLastDifferentIndex(str1: string, str2: string, defaultValue: number = -1): number {
  return getFirstDifferentIndex([...str1].reverse().join(''), [...str2].reverse().join(''), defaultValue);
}

function removeCharacters(baseString: string, charsToRemove: string): string {
  return baseString
    .split('')
    .filter(char => !charsToRemove.includes(char))
    .join('');
}

function noAccent(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function stringToCharCodeArray(str: string): string[] {
  return str.split('').map((char: string): string => {
    return char.charCodeAt(0).toString(16);
  });
}

export const _String = {
  capitalize,
  capitalizeAll,
  rightPad,
  leftPad,
  getFirstDifferentIndex,
  getLastDifferentIndex,
  removeCharacters,
  noAccent,
  stringToCharCodeArray,
  toKebabCase,
};

export type TUtilsString = typeof _String;
import { Text, type TextProps, StyleSheet } from 'react-native';
import { FontFamily, FontSize, LineHeight, LetterSpacing } from '@/constants/Typography';
import Colors from '@/constants/colors';

type Variant =
  | 'h1' | 'h2' | 'h3' | 'h4'
  | 'bodyL' | 'bodyM' | 'bodyS'
  | 'caption'
  | 'label';

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  bold?: boolean;
  semi?: boolean;
}

export default function AppText({
  variant = 'bodyM',
  color,
  bold,
  semi,
  style,
  ...rest
}: Props) {
  return (
    <Text
      style={[styles[variant], color ? { color } : undefined, bold ? { fontFamily: isHeading(variant) ? FontFamily.headingBold : FontFamily.bodyBold } : undefined, semi ? { fontFamily: isHeading(variant) ? FontFamily.headingSemi : FontFamily.bodySemi } : undefined, style]}
      {...rest}
    />
  );
}

function isHeading(v: Variant) {
  return v === 'h1' || v === 'h2' || v === 'h3' || v === 'h4';
}

const styles = StyleSheet.create({
  h1: {
    fontFamily: FontFamily.headingBold,
    fontSize: FontSize.h1,
    lineHeight: LineHeight.h1,
    letterSpacing: LetterSpacing.h1,
    color: Colors.golf.text,
  },
  h2: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.h2,
    lineHeight: LineHeight.h2,
    letterSpacing: LetterSpacing.h2,
    color: Colors.golf.text,
  },
  h3: {
    fontFamily: FontFamily.headingSemi,
    fontSize: FontSize.h3,
    lineHeight: LineHeight.h3,
    color: Colors.golf.text,
  },
  h4: {
    fontFamily: FontFamily.headingSemi,
    fontSize: FontSize.h4,
    lineHeight: LineHeight.h4,
    color: Colors.golf.text,
  },
  bodyL: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodyL,
    lineHeight: LineHeight.bodyL,
    color: Colors.golf.text,
  },
  bodyM: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodyM,
    lineHeight: LineHeight.bodyM,
    color: Colors.golf.text,
  },
  bodyS: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodyS,
    lineHeight: LineHeight.bodyS,
    color: Colors.golf.text,
  },
  caption: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    letterSpacing: LetterSpacing.caption,
    color: Colors.golf.textMuted,
  },
  label: {
    fontFamily: FontFamily.bodySemi,
    fontSize: FontSize.bodyS,
    lineHeight: LineHeight.bodyS,
    letterSpacing: LetterSpacing.label,
    color: Colors.golf.textLight,
    textTransform: 'uppercase',
  },
});

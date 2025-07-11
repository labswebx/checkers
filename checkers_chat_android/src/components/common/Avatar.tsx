import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors, typography } from '../../theme';

interface AvatarProps {
  name?: string;
  imageUrl?: string;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name = '',
  imageUrl,
  size = 50,
  backgroundColor = colors.primary,
  textColor = colors.background,
}) => {
  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor,
  };

  const textStyle = {
    fontSize: size * 0.4,
    color: textColor,
  };

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.container, avatarStyle]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.container, avatarStyle]}>
      <Text style={[styles.initials, textStyle]}>
        {getInitials(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: typography.fontWeight.bold,
  },
});
import React from 'react';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string;
  className?: string;
  style?: React.CSSProperties;
}

const getInitials = (name: string): string => {
  if (!name) return '?';
  const words = name.trim().split(' ').filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};

const generateColor = (name: string): string => {
  if (!name) return '#6B7280'; // gray-500
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  return `hsl(${h}, 60%, 45%)`;
};

const UserAvatar: React.FC<UserAvatarProps> = ({ name, avatarUrl, className, style }) => {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={className} style={style} />;
  }

  const initials = getInitials(name);
  const bgColor = generateColor(name);

  const combinedStyle = {
    backgroundColor: bgColor,
    ...style,
  };

  return (
    <div
      className={`flex items-center justify-center font-bold text-white ${className || ''}`}
      style={combinedStyle}
      title={name}
    >
      {initials}
    </div>
  );
};

export default UserAvatar;

import React from 'react';
import { Cloud, HardDrive, Server, Globe } from 'lucide-react';
import { CloudProvider } from '../types';

interface CloudButtonProps {
  provider: CloudProvider;
  onClick: () => void;
}

export const CloudButton: React.FC<CloudButtonProps> = ({ provider, onClick }) => {
  const config = {
    google: {
      label: 'Google Drive',
      icon: <Globe className="w-5 h-5" />,
      color: 'hover:bg-blue-600 hover:text-white border-blue-600/50 text-blue-400',
    },
    onedrive: {
      label: 'OneDrive',
      icon: <Cloud className="w-5 h-5" />,
      color: 'hover:bg-sky-600 hover:text-white border-sky-600/50 text-sky-400',
    },
    onedrive_biz: {
      label: 'OneDrive Business',
      icon: <Server className="w-5 h-5" />,
      color: 'hover:bg-indigo-600 hover:text-white border-indigo-600/50 text-indigo-400',
    },
    s3: {
      label: 'S3 Drive',
      icon: <HardDrive className="w-5 h-5" />,
      color: 'hover:bg-orange-600 hover:text-white border-orange-600/50 text-orange-400',
    },
  };

  const { label, icon, color } = config[provider];

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed bg-jav-gray/30 transition-all duration-300 ${color} w-full sm:w-auto`}
    >
      {icon}
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
};
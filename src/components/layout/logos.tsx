'use client';

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";

// Shared Logo Components

export const Logo = () => {
    return (
        <Link
            href="/"
            className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black dark:text-white"
        >
            <Image
                src="/receptionist_logo.svg"
                alt="Receptionist Logo"
                width={24}
                height={20}
                className="shrink-0 inline-block align-middle"
            />
            <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-medium whitespace-pre"
            >
                Receptionist
            </motion.span>
        </Link>
    );
};

export const LogoIcon = () => {
    return (
        <Link
            href="/"
            className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal text-black dark:text-white"
        >
            <Image
                src="/receptionist_logo.svg"
                alt="Receptionist Logo Icon"
                width={24}
                height={20}
                className="shrink-0"
            />
        </Link>
    );
}; 
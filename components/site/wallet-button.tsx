"use client";
import Link from "next/link";
import { buttonClass, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export function WalletButton({className,variant="outline",size="sm",label="Connect wallet"}:{className?:string;variant?:ButtonVariant;size?:ButtonSize;label?:string}) { return <Link href="/markets" className={cn(buttonClass(variant,size),className)}>{label}</Link>; }

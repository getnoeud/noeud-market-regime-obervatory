"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  DatabaseIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  LogOutIcon,
  BarChart3Icon,
  SparklesIcon,
  FlaskConicalIcon,
  WavesIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV_MAIN = [
  { title: "Overview", url: "/", icon: LayoutDashboardIcon },
  { title: "Pair Review", url: "/pairs", icon: GaugeIcon },
  { title: "Validation Runs", url: "/validation", icon: SparklesIcon },
  { title: "Performance Lab", url: "/performance", icon: BarChart3Icon },
  { title: "ML Multiplier Lab", url: "/ml-multiplier", icon: FlaskConicalIcon },
  { title: "Maturity Risk Lab", url: "/maturity-risk", icon: WavesIcon },
  { title: "Data Health", url: "/data-health", icon: DatabaseIcon },
];

const NAV_SECONDARY = [{ title: "Help & Methodology", url: "/help", icon: LifeBuoyIcon }];

function isActive(pathname: string, url: string) {
  if (url === "/") return pathname === "/";
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-10 data-[slot=sidebar-menu-button]:p-1.5!">
              <Link href="/">
                <div className="flex aspect-square size-7 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <ActivityIcon className="size-4" />
                </div>
                <span className="truncate text-sm font-semibold">Regime Observatory</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            {NAV_MAIN.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(pathname, item.url)}
                  tooltip={item.title}
                  className="h-9 group-data-[collapsible=icon]:size-9!"
                >
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarMenu className="gap-1">
            {NAV_SECONDARY.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(pathname, item.url)}
                  tooltip={item.title}
                  className="h-9 group-data-[collapsible=icon]:size-9!"
                >
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <form action="/logout" method="post" className="w-full">
              <SidebarMenuButton
                type="submit"
                tooltip="Sign out"
                className="h-9 text-muted-foreground group-data-[collapsible=icon]:size-9!"
              >
                <LogOutIcon />
                <span>Sign out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          Deterministic engine · v0.1
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

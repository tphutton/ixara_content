import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/app/(app)/schedule/actions",()=>({linkImportedPublicationAction:vi.fn()}));
import { PublishingCalendar } from "@/components/schedule/publishing-calendar";
import type { CalendarEntry } from "@/lib/schedule/calendar";
const entry = (id:string,date:string):CalendarEntry=>({id,kind:"schedule",title:`Post ${id}`,date,status:"planned",brand:"Cup",platform:"Instagram",account:"Cup",caption:"Caption",campaign:null,contentId:null,contentTitle:null,scheduleId:id,mediaUrl:null,thumbnail:null,externalUrl:null,metrics:null,syncedAt:null,notes:null});
describe("calendar rendering",()=>{
 it("shows the selected month with expandable overflow and separate campaigns",()=>{const html=renderToStaticMarkup(React.createElement(PublishingCalendar,{entries:[1,2,3,4,5].map(i=>entry(String(i),"2026-11-02T11:30:00Z")),campaigns:[{id:"c",title:"Campaign window",start:"2026-11-01",end:"2026-11-15",brands:["Cup"],status:"draft"}],contentOptions:[],initialMonth:"2026-11"}));expect(html).toContain("November 2026");expect(html).toContain("+2 more posts");expect(html).toContain("<details>");expect(html).toContain("18:30");expect(html).toContain('aria-label="Campaign windows"');});
 it("counts only the displayed week",()=>{const html=renderToStaticMarkup(React.createElement(PublishingCalendar,{entries:[entry("week","2026-11-02T11:30:00Z"),entry("outside","2026-12-02T11:30:00Z")],campaigns:[],contentOptions:[],initialView:"week",initialWeek:"2026-11-02"}));expect(html).toContain("1 posts in this view");expect(html).not.toContain("Post outside");});
});

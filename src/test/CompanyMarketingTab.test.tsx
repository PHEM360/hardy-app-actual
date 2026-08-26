import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import CompanyMarketingTab from "@/components/companies/CompanyMarketingTab";
import type { Company, ContentPiece, MarketingProfile } from "@/types/app";

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  saveProfile: vi.fn(),
  addCampaign: vi.fn(),
  updateCampaign: vi.fn(),
  deleteCampaign: vi.fn(),
  addContent: vi.fn(),
  updateContent: vi.fn(),
  deleteContent: vi.fn(),
  uploadAssets: vi.fn(),
  updateAsset: vi.fn(),
  deleteAsset: vi.fn(),
  generatePlan: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  connectionUrl: vi.fn(),
  generateImage: vi.fn(),
  generateAudit: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/hooks/useCompanyMarketing", () => ({
  useCompanyMarketing: () => mocks.getState(),
}));

vi.mock("@/lib/marketingApi", () => ({
  generateMarketingPlan: mocks.generatePlan,
  approveMarketingContent: mocks.approve,
  rejectMarketingContent: mocks.reject,
  getMarketingConnectionUrl: mocks.connectionUrl,
  generateMarketingImage: mocks.generateImage,
  generateMarketingAudit: mocks.generateAudit,
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

const profile: MarketingProfile = {
  brandVoice: "Warm and expert",
  targetAudience: "Local business owners",
  objectives: ["Build trust"],
  keyMessages: ["Practical help"],
  requiredPhrases: [],
  bannedPhrases: [],
  disclaimers: [],
  preferredHashtags: ["help"],
  competitors: [],
  currentThemes: "",
  platforms: ["instagram", "facebook"],
  tradingNames: [],
  relatedCompanyIds: [],
  industry: "Consulting",
  website: "https://example.com",
  defaultPlanDays: 30,
  postsPerWeek: 3,
  approvalRequired: true,
};

const reviewPost: ContentPiece = {
  id: "review-1",
  type: "social_post",
  platform: "instagram",
  topic: "Helpful advice",
  campaignId: "",
  objective: "Trust",
  audience: "Owners",
  trendReason: "Useful now",
  draft: "Three practical tips for your week.",
  refinedDraft: "",
  hashtags: ["help"],
  assetIds: [],
  aiImagePrompt: "",
  scheduledFor: "2026-09-01T09:00:00.000Z",
  timezone: "Europe/London",
  status: "awaiting_approval",
  approvalVersion: 7,
  approvedVersion: 0,
  approvedAt: "",
  approvedBy: "",
  rejectedAt: "",
  rejectedBy: "",
  rejectionReason: "",
  publishedAt: "",
  externalPostId: "",
  externalPostUrl: "",
  publishAttempts: 0,
  publishError: "",
  aiProvider: "test",
  aiModel: "test",
  aiReasoning: "Matches the weekly theme",
  brandChecks: ["Voice matches"],
  engagementSuggestions: ["Ask a question"],
  revisions: [],
};

const scheduledPost: ContentPiece = {
  ...reviewPost,
  id: "scheduled-1",
  topic: "Scheduled update",
  draft: "Original scheduled copy",
  status: "scheduled",
  approvalVersion: 4,
};

const company: Company = {
  id: "company-1",
  name: "Hardy Studio",
  color: "#6366f1",
  taxYearStart: "2026-04-06",
  contact: {},
};

function marketingState() {
  return {
    profile,
    content: [reviewPost, scheduledPost],
    campaigns: [],
    assets: [],
    connections: [],
    audits: [],
    loading: false,
    saveProfile: mocks.saveProfile,
    addCampaign: mocks.addCampaign,
    updateCampaign: mocks.updateCampaign,
    deleteCampaign: mocks.deleteCampaign,
    addContent: mocks.addContent,
    updateContent: mocks.updateContent,
    deleteContent: mocks.deleteContent,
    uploadAssets: mocks.uploadAssets,
    updateAsset: mocks.updateAsset,
    deleteAsset: mocks.deleteAsset,
    deleteAudit: vi.fn(),
  };
}

function renderTab() {
  return render(<CompanyMarketingTab companyId="company-1" company={company} />);
}

describe("CompanyMarketingTab", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getState.mockImplementation(marketingState);
    mocks.saveProfile.mockResolvedValue(undefined);
    mocks.updateContent.mockResolvedValue(undefined);
    mocks.uploadAssets.mockResolvedValue(undefined);
    mocks.generatePlan.mockResolvedValue({ created: 4, contentIds: [], summary: "Four posts created" });
    mocks.approve.mockResolvedValue({ status: "scheduled" });
    mocks.reject.mockResolvedValue({ status: "rejected" });
    mocks.connectionUrl.mockResolvedValue({ available: false, reason: "Provider credentials have not been configured." });
    mocks.generateAudit.mockResolvedValue({ auditId: "audit-1", headline: "Weekly PR audit" });
  });

  it("saves the complete brand profile", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Brand guidance" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Brand voice" }), { target: { value: "Friendly, plain English" } });
    fireEvent.click(screen.getByRole("button", { name: "Save brand guidance" }));

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      brandVoice: "Friendly, plain English",
      targetAudience: "Local business owners",
    })));
  });

  it("sends the selected plan generation request", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Planner" }));
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "14" } });
    fireEvent.change(screen.getByLabelText("Posts per week"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Campaign focus"), { target: { value: "Autumn launch" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate plan" }));

    await waitFor(() => expect(mocks.generatePlan).toHaveBeenCalledWith("company-1", expect.objectContaining({
      periodDays: 14,
      postsPerWeek: 5,
      focus: "Autumn launch",
      platforms: ["instagram", "facebook"],
      includeImages: true,
    })));
  });

  it("explains how to generate a month of posts", () => {
    renderTab();
    expect(screen.getByRole("heading", { name: "How this works" })).toBeTruthy();
    expect(screen.getByText(/You clicked in/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate next month" })).toBeTruthy();
  });

  it("starts a 30-day pictured plan from overview when brand guidance is ready", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Generate next month" }));
    await waitFor(() => expect(mocks.generatePlan).toHaveBeenCalledWith("company-1", expect.objectContaining({
      periodDays: 30,
      postsPerWeek: 3,
      includeImages: true,
      platforms: ["instagram", "facebook"],
    })));
    expect(mocks.toastSuccess).toHaveBeenCalled();
  });

  it("approves the exact review version", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith("company-1", "review-1", 7));
  });

  it("requires a reason before rejecting", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject post" }));
    expect(mocks.reject).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("Add a reason before rejecting this post.");

    fireEvent.change(screen.getByRole("textbox", { name: "Rejection reason" }), { target: { value: "Make the call to action clearer." } });
    fireEvent.click(screen.getByRole("button", { name: "Reject post" }));
    await waitFor(() => expect(mocks.reject).toHaveBeenCalledWith(
      "company-1",
      "review-1",
      7,
      "Make the call to action clearer.",
    ));
  });

  it("updates edited scheduled content through the hook", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Planner" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit Scheduled update" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Post copy" }), { target: { value: "Revised scheduled copy" } });
    fireEvent.click(screen.getByRole("button", { name: "Save post" }));

    await waitFor(() => expect(mocks.updateContent).toHaveBeenCalledWith("scheduled-1", expect.objectContaining({
      draft: "Revised scheduled copy",
    })));
  });

  it("copies an approved post so it can be pasted onto a social platform", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy post" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain("Three practical tips for your week.");
    expect(writeText.mock.calls[0][0]).toContain("#help");
  });

  it("uploads selected media", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Media" }));
    const file = new File(["image"], "campaign.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Upload images or videos"), { target: { files: [file] } });
    await waitFor(() => expect(mocks.uploadAssets).toHaveBeenCalledWith([file]));
  });

  it("shows the backend reason when a connection is unavailable", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Connections" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect Instagram" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Provider credentials have not been configured.");
  });

  it("runs a PR audit with pasted Search Console notes", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "PR audit" }));
    expect(screen.getByRole("heading", { name: "What this scan can see" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search Console or ranking notes"), {
      target: { value: "boiler repair London is the top query, 1,200 impressions." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run a scan" }));
    await waitFor(() => expect(mocks.generateAudit).toHaveBeenCalledWith("company-1", expect.objectContaining({
      searchNotes: "boiler repair London is the top query, 1,200 impressions.",
    })));
  });
});

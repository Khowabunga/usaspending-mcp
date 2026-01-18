/**
 * REST API endpoint for analyzing competitive landscape
 * This wraps the MCP tool functionality for GPT Actions compatibility
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUSASpendingClient } from '../../../src/clients/usaspending';
import { buildAwardFilters } from '../../../src/builders/filter-builder';
import { COMPETITION_FIELDS, transformCompetitionRecipient } from '../../../src/builders/field-mapper';

const client = createUSASpendingClient();

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();

		// Default to last year if no dates provided
		const activityStartDate = body.activityStartDate || (() => {
			const date = new Date();
			date.setFullYear(date.getFullYear() - 1);
			return date.toISOString().split('T')[0];
		})();
		const activityEndDate = body.activityEndDate || new Date().toISOString().split('T')[0];

		// Build filters using the shared filter builder
		const filters = buildAwardFilters({
			keywords: body.keywords,
			agencyName: body.agencyName,
			naicsCodes: body.naicsCodes,
			pscCodes: body.pscCodes,
			activityStartDate,
			activityEndDate,
			minAmount: body.minAmount,
		});

		const searchParams = {
			filters,
			fields: COMPETITION_FIELDS,
			limit: 100, // Get more results for better analysis
			page: 1,
			sort: "Award Amount",
			order: "desc" as const,
		};

		const result = await client.searchAwards(searchParams);

		// Aggregate by recipient
		const recipientMap = new Map<string, {
			name: string;
			uei: string;
			totalAmount: number;
			awardCount: number;
			awards: string[];
		}>();

		for (const award of result.results || []) {
			const name = String(award["Recipient Name"] || "Unknown");
			const uei = String(award["Recipient UEI"] || "");
			const amount = Number(award["Award Amount"]) || 0;
			const id = String(award["Award ID"] || "");

			if (!recipientMap.has(name)) {
				recipientMap.set(name, {
					name,
					uei,
					totalAmount: 0,
					awardCount: 0,
					awards: [],
				});
			}

			const recipient = recipientMap.get(name)!;
			recipient.totalAmount += amount;
			recipient.awardCount += 1;
			recipient.awards.push(id);
		}

		// Convert to array and sort by total amount
		const topRecipients = Array.from(recipientMap.values())
			.sort((a, b) => b.totalAmount - a.totalAmount)
			.slice(0, body.limit || 20);

		const totalMarketSize = topRecipients.reduce((sum, r) => sum + r.totalAmount, 0);

		return NextResponse.json({
			summary: `Competitive analysis showing top ${topRecipients.length} recipients`,
			total_awards_analyzed: result.page_metadata?.total || 0,
			total_market_size: totalMarketSize,
			date_range: {
				start: activityStartDate,
				end: activityEndDate,
			},
			top_recipients: topRecipients.map(r => transformCompetitionRecipient(r, totalMarketSize)),
		});
	} catch (error) {
		console.error('[API] analyze-competition error:', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
	return new NextResponse(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
}

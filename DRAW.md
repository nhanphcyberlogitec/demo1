# Agent Team Workflow — 6 Slides (one per phase)

Source: [`.claude/agent-team-workflow.md`](.claude/agent-team-workflow.md)

Each phase lives on its own draw.io page (`<diagram>`), sized **1920 × 1080 (16:9)** to match Google Slides. Export each page as its own PNG (**File → Export as → PNG → Current page**) and drop it on its own slide.

## Slide plan

| Slide | Phase | Content |
|-------|-------|---------|
| 0 | Overview | Single-glance summary of all 6 phases, with main agent + output + approval gate per phase |
| 1 | Phase 1 — Requirements | `business-analyst` writes `PROTOTYPE.md`, user approves |
| 2 | Phase 2 — Specification | `technical-writer` writes `TECH_SPEC.md`, user approves |
| 3 | Phase 3 — Design & Build | `data-modeler`, `backend-developer`, `ui-designer` in parallel, three approval gates |
| 4 | Phase 4 — Frontend Integration | `frontend-developer` pushes `admin/` to `develop-test-3`, user approves built UI |
| 5 | Phase 5 — Test & Fix Loop | `qa-tester` runs tests, files issues; fix devs close them; re-test until green |
| 6 | Phase 6 — Review | `reviewer` writes `EXPERT_REVIEW.md`, present to user |

## Legend (applies to every slide)

- **Rounded rectangle** — agent (bold name + italic `Inputs:` line)
- **Document shape** — shared artifact file
- **Red diamond** — user-approval gate (blocking checkpoint)
- **Ellipse** — start / end
- **Solid arrow** — forward flow / agent writes file
- **Dashed arrow** — cross-phase notification or fix-loop re-test

## draw.io XML — 6 pages

Paste the block below into **Extras → Edit Diagram…** in draw.io. You'll get six pages in the page tabs at the bottom. Export each with **File → Export as → PNG → Current page** (Zoom 200%, Transparent Background).

```xml
<mxfile host="app.diagrams.net" modified="2026-04-15T00:00:00.000Z" agent="claude-code" version="24.0.0">

  <!-- ========== SLIDE 0 — Overview (all phases) ========== -->
  <diagram id="overview" name="0 · Overview">
    <mxGraphModel dx="1920" dy="1080" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1920" pageHeight="1080" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <mxCell id="title0" value="Agent Team Workflow — Overview" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=36;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="360" y="40" width="1200" height="60" as="geometry" />
        </mxCell>
        <mxCell id="sub0" value="6 phases · one task folder · user-approval gate between every phase" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=2;fontColor=#666666;" vertex="1" parent="1">
          <mxGeometry x="360" y="100" width="1200" height="30" as="geometry" />
        </mxCell>

        <!-- Start -->
        <mxCell id="ov_start" value="User&#xa;Request" style="ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="20" y="490" width="110" height="70" as="geometry" />
        </mxCell>

        <!-- Phase 1 card -->
        <mxCell id="ov_p1" value="Phase 1 — Requirements" style="swimlane;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;startSize=34;fontSize=14;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="160" y="310" width="220" height="440" as="geometry" />
        </mxCell>
        <mxCell id="ov_ba" value="business-analyst" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#d6b656;fontSize=13;" vertex="1" parent="ov_p1">
          <mxGeometry x="20" y="60" width="180" height="60" as="geometry" />
        </mxCell>
        <mxCell id="ov_f1" value="PROTOTYPE.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=12;" vertex="1" parent="ov_p1">
          <mxGeometry x="30" y="150" width="160" height="46" as="geometry" />
        </mxCell>
        <mxCell id="ov_g1" value="user&#xa;approval" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=12;" vertex="1" parent="ov_p1">
          <mxGeometry x="30" y="230" width="160" height="70" as="geometry" />
        </mxCell>
        <mxCell id="ov_e_ba_f1" edge="1" parent="ov_p1" source="ov_ba" target="ov_f1" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="ov_e_f1_g1" edge="1" parent="ov_p1" source="ov_f1" target="ov_g1" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>

        <!-- Phase 2 card -->
        <mxCell id="ov_p2" value="Phase 2 — Specification" style="swimlane;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;startSize=34;fontSize=14;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="400" y="310" width="220" height="440" as="geometry" />
        </mxCell>
        <mxCell id="ov_tw" value="technical-writer" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#d6b656;fontSize=13;" vertex="1" parent="ov_p2">
          <mxGeometry x="20" y="60" width="180" height="60" as="geometry" />
        </mxCell>
        <mxCell id="ov_f2" value="TECH_SPEC.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=12;" vertex="1" parent="ov_p2">
          <mxGeometry x="30" y="150" width="160" height="46" as="geometry" />
        </mxCell>
        <mxCell id="ov_g2" value="user&#xa;approval" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=12;" vertex="1" parent="ov_p2">
          <mxGeometry x="30" y="230" width="160" height="70" as="geometry" />
        </mxCell>
        <mxCell id="ov_e_tw_f2" edge="1" parent="ov_p2" source="ov_tw" target="ov_f2" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="ov_e_f2_g2" edge="1" parent="ov_p2" source="ov_f2" target="ov_g2" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>

        <!-- Phase 3 card — parallel, taller -->
        <mxCell id="ov_p3" value="Phase 3 — Design &amp; Build (parallel)" style="swimlane;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;startSize=34;fontSize=14;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="640" y="240" width="260" height="660" as="geometry" />
        </mxCell>
        <mxCell id="ov_dm" value="data-modeler" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#82b366;fontSize=12;" vertex="1" parent="ov_p3">
          <mxGeometry x="20" y="50" width="220" height="44" as="geometry" />
        </mxCell>
        <mxCell id="ov_fdm" value="DB_SCHEMA.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=11;" vertex="1" parent="ov_p3">
          <mxGeometry x="40" y="104" width="180" height="38" as="geometry" />
        </mxCell>
        <mxCell id="ov_be" value="backend-developer" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#82b366;fontSize=12;" vertex="1" parent="ov_p3">
          <mxGeometry x="20" y="170" width="220" height="44" as="geometry" />
        </mxCell>
        <mxCell id="ov_fbe" value="BACKEND_API.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=11;" vertex="1" parent="ov_p3">
          <mxGeometry x="40" y="224" width="180" height="38" as="geometry" />
        </mxCell>
        <mxCell id="ov_ui" value="ui-designer" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#82b366;fontSize=12;" vertex="1" parent="ov_p3">
          <mxGeometry x="20" y="290" width="220" height="44" as="geometry" />
        </mxCell>
        <mxCell id="ov_fui" value="Figma design" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=11;" vertex="1" parent="ov_p3">
          <mxGeometry x="40" y="344" width="180" height="38" as="geometry" />
        </mxCell>
        <mxCell id="ov_g3" value="3 user approvals&#xa;(DB_SCHEMA, BACKEND_API, Figma)" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=11;" vertex="1" parent="ov_p3">
          <mxGeometry x="25" y="420" width="210" height="110" as="geometry" />
        </mxCell>

        <!-- Phase 4 card -->
        <mxCell id="ov_p4" value="Phase 4 — Frontend Integration" style="swimlane;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;startSize=34;fontSize=14;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="920" y="310" width="220" height="440" as="geometry" />
        </mxCell>
        <mxCell id="ov_fe" value="frontend-developer" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#d6b656;fontSize=13;" vertex="1" parent="ov_p4">
          <mxGeometry x="20" y="60" width="180" height="60" as="geometry" />
        </mxCell>
        <mxCell id="ov_f4" value="admin/ pushed to&#xa;develop-test-3" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e8f5e9;strokeColor=#82b366;fontSize=11;" vertex="1" parent="ov_p4">
          <mxGeometry x="20" y="145" width="180" height="56" as="geometry" />
        </mxCell>
        <mxCell id="ov_g4" value="user approval&#xa;(built UI)" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=12;" vertex="1" parent="ov_p4">
          <mxGeometry x="20" y="225" width="180" height="80" as="geometry" />
        </mxCell>
        <mxCell id="ov_e_fe_f4" edge="1" parent="ov_p4" source="ov_fe" target="ov_f4" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="ov_e_f4_g4" edge="1" parent="ov_p4" source="ov_f4" target="ov_g4" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>

        <!-- Phase 5 card — loop, taller -->
        <mxCell id="ov_p5" value="Phase 5 — Test &amp; Fix Loop" style="swimlane;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;startSize=34;fontSize=14;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="1160" y="260" width="260" height="620" as="geometry" />
        </mxCell>
        <mxCell id="ov_qa" value="qa-tester" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#9673a6;fontSize=13;" vertex="1" parent="ov_p5">
          <mxGeometry x="40" y="50" width="180" height="54" as="geometry" />
        </mxCell>
        <mxCell id="ov_f5a" value="TEST_CASES.md&#xa;BUG_REPORT.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=11;" vertex="1" parent="ov_p5">
          <mxGeometry x="40" y="120" width="180" height="50" as="geometry" />
        </mxCell>
        <mxCell id="ov_f5b" value="GitHub Issues&#xa;(frontend / backend)" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=11;" vertex="1" parent="ov_p5">
          <mxGeometry x="40" y="186" width="180" height="50" as="geometry" />
        </mxCell>
        <mxCell id="ov_fix" value="fix devs&#xa;(frontend / backend)&#xa;close issues, push" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#9673a6;fontSize=11;" vertex="1" parent="ov_p5">
          <mxGeometry x="40" y="256" width="180" height="70" as="geometry" />
        </mxCell>
        <mxCell id="ov_loop" value="re-test until green" style="text;html=1;strokeColor=none;fillColor=none;fontSize=11;fontStyle=2;fontColor=#9673a6;align=center;" vertex="1" parent="ov_p5">
          <mxGeometry x="40" y="340" width="180" height="24" as="geometry" />
        </mxCell>
        <mxCell id="ov_g5" value="all tests pass&#xa;zero open issues" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=12;" vertex="1" parent="ov_p5">
          <mxGeometry x="40" y="380" width="180" height="100" as="geometry" />
        </mxCell>
        <mxCell id="ov_e_qa_f5a" edge="1" parent="ov_p5" source="ov_qa" target="ov_f5a" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="ov_e_f5a_f5b" edge="1" parent="ov_p5" source="ov_f5a" target="ov_f5b" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="ov_e_f5b_fix" edge="1" parent="ov_p5" source="ov_f5b" target="ov_fix" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="ov_e_fix_qa" edge="1" parent="ov_p5" source="ov_fix" target="ov_qa" style="endArrow=block;html=1;dashed=1;exitX=0;exitY=0.5;entryX=0;entryY=0.5;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="20" y="291" />
              <mxPoint x="20" y="77" />
            </Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="ov_e_fix_g5" edge="1" parent="ov_p5" source="ov_fix" target="ov_g5" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>

        <!-- Phase 6 card -->
        <mxCell id="ov_p6" value="Phase 6 — Review" style="swimlane;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;startSize=34;fontSize=14;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="1440" y="310" width="220" height="440" as="geometry" />
        </mxCell>
        <mxCell id="ov_rv" value="reviewer" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#6c8ebf;fontSize=13;" vertex="1" parent="ov_p6">
          <mxGeometry x="20" y="60" width="180" height="60" as="geometry" />
        </mxCell>
        <mxCell id="ov_f6" value="EXPERT_REVIEW.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=12;" vertex="1" parent="ov_p6">
          <mxGeometry x="20" y="150" width="180" height="50" as="geometry" />
        </mxCell>
        <mxCell id="ov_pres" value="present to user" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e8f5e9;strokeColor=#82b366;fontSize=12;" vertex="1" parent="ov_p6">
          <mxGeometry x="20" y="230" width="180" height="50" as="geometry" />
        </mxCell>
        <mxCell id="ov_e_rv_f6" edge="1" parent="ov_p6" source="ov_rv" target="ov_f6" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="ov_e_f6_pres" edge="1" parent="ov_p6" source="ov_f6" target="ov_pres" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>

        <!-- End -->
        <mxCell id="ov_end" value="TeamDelete" style="ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1700" y="490" width="140" height="70" as="geometry" />
        </mxCell>

        <!-- Inter-phase arrows -->
        <mxCell id="ov_e01" edge="1" parent="1" source="ov_start" target="ov_p1" style="endArrow=block;html=1;strokeWidth=2;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="ov_e12" edge="1" parent="1" source="ov_p1" target="ov_p2" style="endArrow=block;html=1;strokeWidth=2;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="ov_e23" edge="1" parent="1" source="ov_p2" target="ov_p3" style="endArrow=block;html=1;strokeWidth=2;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="ov_e34" edge="1" parent="1" source="ov_p3" target="ov_p4" style="endArrow=block;html=1;strokeWidth=2;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="ov_e45" edge="1" parent="1" source="ov_p4" target="ov_p5" style="endArrow=block;html=1;strokeWidth=2;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="ov_e56" edge="1" parent="1" source="ov_p5" target="ov_p6" style="endArrow=block;html=1;strokeWidth=2;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="ov_e6e" edge="1" parent="1" source="ov_p6" target="ov_end" style="endArrow=block;html=1;strokeWidth=2;"><mxGeometry relative="1" as="geometry" /></mxCell>

        <!-- Footer legend -->
        <mxCell id="ov_legend" value="Solid arrow = forward flow · Dashed arrow = fix-loop re-test · Red diamond = user-approval gate (blocks until approved)" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=13;fontStyle=2;fontColor=#888888;" vertex="1" parent="1">
          <mxGeometry x="200" y="960" width="1520" height="30" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>

  <!-- ========== SLIDE 1 — Phase 1: Requirements ========== -->
  <diagram id="phase1" name="1 · Requirements">
    <mxGraphModel dx="1920" dy="1080" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1920" pageHeight="1080" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <mxCell id="title1" value="Phase 1 — Requirements" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=36;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="560" y="60" width="800" height="60" as="geometry" />
        </mxCell>
        <mxCell id="sub1" value="Gate: user approval of PROTOTYPE.md" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=2;fontColor=#666666;" vertex="1" parent="1">
          <mxGeometry x="560" y="125" width="800" height="30" as="geometry" />
        </mxCell>
        <mxCell id="step1" value="1 of 6" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1760" y="60" width="100" height="40" as="geometry" />
        </mxCell>

        <mxCell id="start_1" value="User Request" style="ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=16;" vertex="1" parent="1">
          <mxGeometry x="80" y="490" width="160" height="60" as="geometry" />
        </mxCell>
        <mxCell id="f_req_1" value="requirement.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="310" y="495" width="180" height="50" as="geometry" />
        </mxCell>
        <mxCell id="ba_1" value="&lt;b style=&quot;font-size:18px&quot;&gt;business-analyst&lt;/b&gt;&#xa;&lt;i&gt;Inputs: requirement.md&lt;/i&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#d6b656;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="570" y="460" width="280" height="120" as="geometry" />
        </mxCell>
        <mxCell id="f_proto_1" value="PROTOTYPE.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="920" y="495" width="180" height="50" as="geometry" />
        </mxCell>
        <mxCell id="g1_1" value="Approve&#xa;PROTOTYPE.md?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1180" y="475" width="220" height="90" as="geometry" />
        </mxCell>
        <mxCell id="next_1" value="→ Phase 2&#xa;Specification" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1f5fe;strokeColor=#6c8ebf;dashed=1;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1500" y="490" width="200" height="60" as="geometry" />
        </mxCell>

        <mxCell id="e1_1" edge="1" parent="1" source="start_1" target="f_req_1" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e2_1" edge="1" parent="1" source="f_req_1" target="ba_1" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e3_1" edge="1" parent="1" source="ba_1" target="f_proto_1" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e4_1" edge="1" parent="1" source="f_proto_1" target="g1_1" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e5_1" value="yes" edge="1" parent="1" source="g1_1" target="next_1" style="endArrow=block;html=1;strokeWidth=2;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e6_1" value="no, revise" edge="1" parent="1" source="g1_1" target="ba_1" style="endArrow=block;html=1;exitX=0.5;exitY=0;entryX=0.5;entryY=0;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="1290" y="390" />
              <mxPoint x="710" y="390" />
            </Array>
          </mxGeometry>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>

  <!-- ========== SLIDE 2 — Phase 2: Specification ========== -->
  <diagram id="phase2" name="2 · Specification">
    <mxGraphModel dx="1920" dy="1080" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1920" pageHeight="1080" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <mxCell id="title2" value="Phase 2 — Specification" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=36;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="560" y="60" width="800" height="60" as="geometry" />
        </mxCell>
        <mxCell id="sub2" value="Gate: user approval of TECH_SPEC.md" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=2;fontColor=#666666;" vertex="1" parent="1">
          <mxGeometry x="560" y="125" width="800" height="30" as="geometry" />
        </mxCell>
        <mxCell id="step2" value="2 of 6" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1760" y="60" width="100" height="40" as="geometry" />
        </mxCell>

        <mxCell id="prev_2" value="← Phase 1&#xa;PROTOTYPE.md approved" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#999999;dashed=1;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="80" y="490" width="220" height="60" as="geometry" />
        </mxCell>
        <mxCell id="f_proto_2" value="PROTOTYPE.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="360" y="495" width="180" height="50" as="geometry" />
        </mxCell>
        <mxCell id="tw_2" value="&lt;b style=&quot;font-size:18px&quot;&gt;technical-writer&lt;/b&gt;&#xa;&lt;i&gt;Inputs: PROTOTYPE.md&lt;/i&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#d6b656;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="620" y="460" width="280" height="120" as="geometry" />
        </mxCell>
        <mxCell id="f_spec_2" value="TECH_SPEC.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="970" y="495" width="180" height="50" as="geometry" />
        </mxCell>
        <mxCell id="g2_2" value="Approve&#xa;TECH_SPEC.md?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1230" y="475" width="220" height="90" as="geometry" />
        </mxCell>
        <mxCell id="next_2" value="→ Phase 3&#xa;Design &amp; Build" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1f5fe;strokeColor=#6c8ebf;dashed=1;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1550" y="490" width="200" height="60" as="geometry" />
        </mxCell>

        <mxCell id="e1_2" edge="1" parent="1" source="prev_2" target="f_proto_2" style="endArrow=block;html=1;dashed=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e2_2" edge="1" parent="1" source="f_proto_2" target="tw_2" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e3_2" edge="1" parent="1" source="tw_2" target="f_spec_2" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e4_2" edge="1" parent="1" source="f_spec_2" target="g2_2" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e5_2" value="yes" edge="1" parent="1" source="g2_2" target="next_2" style="endArrow=block;html=1;strokeWidth=2;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e6_2" value="no, revise" edge="1" parent="1" source="g2_2" target="tw_2" style="endArrow=block;html=1;exitX=0.5;exitY=0;entryX=0.5;entryY=0;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="1340" y="390" />
              <mxPoint x="760" y="390" />
            </Array>
          </mxGeometry>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>

  <!-- ========== SLIDE 3 — Phase 3: Design & Build (parallel) ========== -->
  <diagram id="phase3" name="3 · Design &amp; Build">
    <mxGraphModel dx="1920" dy="1080" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1920" pageHeight="1080" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <mxCell id="title3" value="Phase 3 — Design &amp; Build (parallel)" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=36;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="400" y="50" width="1120" height="60" as="geometry" />
        </mxCell>
        <mxCell id="sub3" value="Three agents run in parallel; each output has its own user-approval gate" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=2;fontColor=#666666;" vertex="1" parent="1">
          <mxGeometry x="400" y="110" width="1120" height="30" as="geometry" />
        </mxCell>
        <mxCell id="step3" value="3 of 6" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1760" y="60" width="100" height="40" as="geometry" />
        </mxCell>

        <mxCell id="prev_3" value="← Phase 2&#xa;PROTOTYPE.md + TECH_SPEC.md approved" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#999999;dashed=1;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="40" y="500" width="260" height="70" as="geometry" />
        </mxCell>

        <!-- Lane A: data-modeler -->
        <mxCell id="dm_3" value="&lt;b style=&quot;font-size:16px&quot;&gt;data-modeler&lt;/b&gt;&#xa;&lt;i&gt;Inputs: PROTOTYPE.md,&#xa;TECH_SPEC.md&lt;/i&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#82b366;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="360" y="220" width="260" height="110" as="geometry" />
        </mxCell>
        <mxCell id="f_db_3" value="DB_SCHEMA.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="680" y="250" width="170" height="50" as="geometry" />
        </mxCell>
        <mxCell id="g3a_3" value="Approve&#xa;DB_SCHEMA?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="910" y="230" width="200" height="90" as="geometry" />
        </mxCell>

        <!-- Lane B: backend-developer -->
        <mxCell id="be_3" value="&lt;b style=&quot;font-size:16px&quot;&gt;backend-developer&lt;/b&gt; (core/)&#xa;&lt;i&gt;Inputs: PROTOTYPE.md,&#xa;TECH_SPEC.md, DB_SCHEMA.md&lt;/i&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#82b366;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="360" y="480" width="260" height="120" as="geometry" />
        </mxCell>
        <mxCell id="f_api_3" value="BACKEND_API.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="680" y="515" width="170" height="50" as="geometry" />
        </mxCell>
        <mxCell id="g3b_3" value="Approve&#xa;BACKEND_API?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="910" y="495" width="200" height="90" as="geometry" />
        </mxCell>

        <!-- Lane C: ui-designer -->
        <mxCell id="f_fig_3" value="FIGMALINK.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="150" y="810" width="160" height="50" as="geometry" />
        </mxCell>
        <mxCell id="ui_3" value="&lt;b style=&quot;font-size:16px&quot;&gt;ui-designer&lt;/b&gt;&#xa;&lt;i&gt;Inputs: PROTOTYPE.md,&#xa;TECH_SPEC.md, FIGMALINK.md&lt;/i&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#82b366;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="360" y="780" width="260" height="120" as="geometry" />
        </mxCell>
        <mxCell id="f_figma_3" value="Figma design" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="680" y="815" width="170" height="50" as="geometry" />
        </mxCell>
        <mxCell id="g3c_3" value="Approve&#xa;Figma?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="910" y="795" width="200" height="90" as="geometry" />
        </mxCell>

        <mxCell id="next_3" value="→ Phase 4&#xa;Frontend Integration" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1f5fe;strokeColor=#6c8ebf;dashed=1;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1220" y="490" width="220" height="80" as="geometry" />
        </mxCell>

        <!-- Edges -->
        <mxCell id="e_prev_dm_3" edge="1" parent="1" source="prev_3" target="dm_3" style="endArrow=block;html=1;dashed=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e_prev_be_3" edge="1" parent="1" source="prev_3" target="be_3" style="endArrow=block;html=1;dashed=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e_prev_ui_3" edge="1" parent="1" source="prev_3" target="ui_3" style="endArrow=block;html=1;dashed=1;"><mxGeometry relative="1" as="geometry" /></mxCell>

        <mxCell id="e_dm_db_3" edge="1" parent="1" source="dm_3" target="f_db_3" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e_db_g3a_3" edge="1" parent="1" source="f_db_3" target="g3a_3" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e_be_api_3" edge="1" parent="1" source="be_3" target="f_api_3" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e_api_g3b_3" edge="1" parent="1" source="f_api_3" target="g3b_3" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e_fig_ui_3" edge="1" parent="1" source="f_fig_3" target="ui_3" style="endArrow=block;html=1;dashed=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e_ui_figma_3" edge="1" parent="1" source="ui_3" target="f_figma_3" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e_figma_g3c_3" edge="1" parent="1" source="f_figma_3" target="g3c_3" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>

        <mxCell id="e_g3a_be_3" value="approved → unblock BE" edge="1" parent="1" source="g3a_3" target="be_3" style="endArrow=block;html=1;dashed=1;exitX=0;exitY=1;entryX=0.5;entryY=0;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="910" y="400" />
              <mxPoint x="490" y="400" />
            </Array>
          </mxGeometry>
        </mxCell>

        <mxCell id="e_g3b_next_3" value="yes" edge="1" parent="1" source="g3b_3" target="next_3" style="endArrow=block;html=1;strokeWidth=2;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e_g3c_next_3" value="yes" edge="1" parent="1" source="g3c_3" target="next_3" style="endArrow=block;html=1;strokeWidth=2;exitX=1;exitY=0.5;entryX=0;entryY=0.5;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="1180" y="840" />
              <mxPoint x="1180" y="530" />
            </Array>
          </mxGeometry>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>

  <!-- ========== SLIDE 4 — Phase 4: Frontend Integration ========== -->
  <diagram id="phase4" name="4 · Frontend Integration">
    <mxGraphModel dx="1920" dy="1080" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1920" pageHeight="1080" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <mxCell id="title4" value="Phase 4 — Frontend Integration" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=36;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="500" y="60" width="920" height="60" as="geometry" />
        </mxCell>
        <mxCell id="sub4" value="Gate: user approval of the built UI running against the real backend" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=2;fontColor=#666666;" vertex="1" parent="1">
          <mxGeometry x="500" y="125" width="920" height="30" as="geometry" />
        </mxCell>
        <mxCell id="step4" value="4 of 6" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1760" y="60" width="100" height="40" as="geometry" />
        </mxCell>

        <mxCell id="prev_4" value="← Phase 3&#xa;BACKEND_API.md + Figma approved" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#999999;dashed=1;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="60" y="470" width="260" height="70" as="geometry" />
        </mxCell>
        <mxCell id="f_api_4" value="BACKEND_API.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="380" y="400" width="180" height="50" as="geometry" />
        </mxCell>
        <mxCell id="f_fig_4" value="FIGMALINK.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="380" y="470" width="180" height="50" as="geometry" />
        </mxCell>
        <mxCell id="f_proto_4" value="PROTOTYPE.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="380" y="540" width="180" height="50" as="geometry" />
        </mxCell>
        <mxCell id="f_spec_4" value="TECH_SPEC.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="380" y="610" width="180" height="50" as="geometry" />
        </mxCell>

        <mxCell id="fe_4" value="&lt;b style=&quot;font-size:18px&quot;&gt;frontend-developer&lt;/b&gt;&#xa;push admin/ → develop-test-3&#xa;&lt;i&gt;Inputs: PROTOTYPE.md, TECH_SPEC.md,&#xa;BACKEND_API.md, FIGMALINK.md&lt;/i&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#d6b656;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="640" y="440" width="320" height="180" as="geometry" />
        </mxCell>
        <mxCell id="build_4" value="Run UI locally&#xa;(admin/ on develop-test-3)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e8f5e9;strokeColor=#82b366;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1000" y="490" width="240" height="80" as="geometry" />
        </mxCell>
        <mxCell id="g4_4" value="Approve&#xa;built UI?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1290" y="480" width="220" height="100" as="geometry" />
        </mxCell>
        <mxCell id="next_4" value="→ Phase 5&#xa;Test &amp; Fix Loop&#xa;(&#39;frontend approved&#39;)" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1f5fe;strokeColor=#6c8ebf;dashed=1;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1590" y="490" width="240" height="80" as="geometry" />
        </mxCell>

        <mxCell id="e1_4" edge="1" parent="1" source="prev_4" target="f_api_4" style="endArrow=block;html=1;dashed=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e2_4" edge="1" parent="1" source="f_api_4" target="fe_4" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e3_4" edge="1" parent="1" source="f_fig_4" target="fe_4" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e4_4" edge="1" parent="1" source="f_proto_4" target="fe_4" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e5_4" edge="1" parent="1" source="f_spec_4" target="fe_4" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e6_4" edge="1" parent="1" source="fe_4" target="build_4" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e7_4" edge="1" parent="1" source="build_4" target="g4_4" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e8_4" value="yes" edge="1" parent="1" source="g4_4" target="next_4" style="endArrow=block;html=1;strokeWidth=2;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e9_4" value="no, revise" edge="1" parent="1" source="g4_4" target="fe_4" style="endArrow=block;html=1;exitX=0.5;exitY=0;entryX=0.5;entryY=0;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="1400" y="380" />
              <mxPoint x="800" y="380" />
            </Array>
          </mxGeometry>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>

  <!-- ========== SLIDE 5 — Phase 5: Test & Fix Loop ========== -->
  <diagram id="phase5" name="5 · Test &amp; Fix Loop">
    <mxGraphModel dx="1920" dy="1080" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1920" pageHeight="1080" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <mxCell id="title5" value="Phase 5 — Test &amp; Fix Loop" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=36;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="500" y="50" width="920" height="60" as="geometry" />
        </mxCell>
        <mxCell id="sub5" value="qa-tester files issues → fix devs close them → re-test until green" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=2;fontColor=#666666;" vertex="1" parent="1">
          <mxGeometry x="500" y="110" width="920" height="30" as="geometry" />
        </mxCell>
        <mxCell id="step5" value="5 of 6" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1760" y="60" width="100" height="40" as="geometry" />
        </mxCell>

        <mxCell id="prev_5" value="← Phase 4&#xa;&#39;frontend approved&#39;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#999999;dashed=1;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="40" y="480" width="220" height="70" as="geometry" />
        </mxCell>

        <mxCell id="qa_5" value="&lt;b style=&quot;font-size:18px&quot;&gt;qa-tester&lt;/b&gt;&#xa;&lt;i&gt;Inputs: PROTOTYPE.md,&#xa;TECH_SPEC.md, BACKEND_API.md&lt;/i&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#9673a6;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="320" y="460" width="280" height="120" as="geometry" />
        </mxCell>

        <mxCell id="f_tc_5" value="TEST_CASES.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="680" y="280" width="190" height="50" as="geometry" />
        </mxCell>
        <mxCell id="f_bug_5" value="BUG_REPORT.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="680" y="500" width="190" height="50" as="geometry" />
        </mxCell>
        <mxCell id="f_iss_5" value="GitHub Issues&#xa;(frontend / backend)" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="680" y="720" width="200" height="64" as="geometry" />
        </mxCell>

        <mxCell id="fixfe_5" value="&lt;b style=&quot;font-size:16px&quot;&gt;frontend-developer&lt;/b&gt;&#xa;(fix &#39;frontend&#39; issues)&#xa;&lt;i&gt;Inputs: GitHub Issues&lt;/i&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#9673a6;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="960" y="690" width="260" height="90" as="geometry" />
        </mxCell>
        <mxCell id="fixbe_5" value="&lt;b style=&quot;font-size:16px&quot;&gt;backend-developer&lt;/b&gt;&#xa;(fix &#39;backend&#39; issues)&#xa;&lt;i&gt;Inputs: GitHub Issues&lt;/i&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#9673a6;fontSize=13;" vertex="1" parent="1">
          <mxGeometry x="960" y="800" width="260" height="90" as="geometry" />
        </mxCell>

        <mxCell id="g5_5" value="All tests pass &amp;&#xa;zero open issues?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1310" y="460" width="240" height="110" as="geometry" />
        </mxCell>
        <mxCell id="next_5" value="→ Phase 6&#xa;Review" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1f5fe;strokeColor=#6c8ebf;dashed=1;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1640" y="490" width="200" height="60" as="geometry" />
        </mxCell>

        <mxCell id="e1_5" edge="1" parent="1" source="prev_5" target="qa_5" style="endArrow=block;html=1;dashed=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e2_5" edge="1" parent="1" source="qa_5" target="f_tc_5" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e3_5" edge="1" parent="1" source="qa_5" target="f_bug_5" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e4_5" edge="1" parent="1" source="qa_5" target="f_iss_5" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e5_5" value="label:frontend" edge="1" parent="1" source="f_iss_5" target="fixfe_5" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e6_5" value="label:backend" edge="1" parent="1" source="f_iss_5" target="fixbe_5" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e7_5" value="re-test" edge="1" parent="1" source="fixfe_5" target="qa_5" style="endArrow=block;html=1;dashed=1;exitX=0.5;exitY=0;entryX=0.5;entryY=0;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="1090" y="400" />
              <mxPoint x="460" y="400" />
            </Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="e8_5" value="re-test" edge="1" parent="1" source="fixbe_5" target="qa_5" style="endArrow=block;html=1;dashed=1;exitX=0;exitY=0.5;entryX=0;entryY=1;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="920" y="930" />
              <mxPoint x="280" y="930" />
              <mxPoint x="280" y="600" />
            </Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="e9_5" edge="1" parent="1" source="qa_5" target="g5_5" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e10_5" value="no, loop" edge="1" parent="1" source="g5_5" target="qa_5" style="endArrow=block;html=1;exitX=0.5;exitY=0;entryX=0.5;entryY=0;">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="1430" y="370" />
              <mxPoint x="460" y="370" />
            </Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="e11_5" value="yes" edge="1" parent="1" source="g5_5" target="next_5" style="endArrow=block;html=1;strokeWidth=2;"><mxGeometry relative="1" as="geometry" /></mxCell>
      </root>
    </mxGraphModel>
  </diagram>

  <!-- ========== SLIDE 6 — Phase 6: Review ========== -->
  <diagram id="phase6" name="6 · Review">
    <mxGraphModel dx="1920" dy="1080" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1920" pageHeight="1080" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />

        <mxCell id="title6" value="Phase 6 — Review" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=36;fontStyle=1;" vertex="1" parent="1">
          <mxGeometry x="560" y="60" width="800" height="60" as="geometry" />
        </mxCell>
        <mxCell id="sub6" value="Runs only after Phase 5 exits green: all tests pass, zero open issues" style="text;html=1;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;fontSize=18;fontStyle=2;fontColor=#666666;" vertex="1" parent="1">
          <mxGeometry x="560" y="125" width="800" height="30" as="geometry" />
        </mxCell>
        <mxCell id="step6" value="6 of 6" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1760" y="60" width="100" height="40" as="geometry" />
        </mxCell>

        <mxCell id="prev_6" value="← Phase 5&#xa;All tests pass, zero open issues" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#999999;dashed=1;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="60" y="490" width="260" height="70" as="geometry" />
        </mxCell>
        <mxCell id="rv_6" value="&lt;b style=&quot;font-size:18px&quot;&gt;reviewer&lt;/b&gt;&#xa;&lt;i&gt;Inputs: all prior artifacts&#xa;(PROTOTYPE, TECH_SPEC, DB_SCHEMA,&#xa;BACKEND_API, TEST_CASES, BUG_REPORT,&#xa;codebase)&lt;/i&gt;" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#6c8ebf;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="400" y="440" width="320" height="160" as="geometry" />
        </mxCell>
        <mxCell id="f_rev_6" value="EXPERT_REVIEW.md" style="shape=document;whiteSpace=wrap;html=1;fillColor=#fffbe6;strokeColor=#d4b106;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="800" y="495" width="200" height="50" as="geometry" />
        </mxCell>
        <mxCell id="present_6" value="Present to user" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e8f5e9;strokeColor=#82b366;fontSize=14;" vertex="1" parent="1">
          <mxGeometry x="1080" y="485" width="200" height="70" as="geometry" />
        </mxCell>
        <mxCell id="end_6" value="TeamDelete" style="ellipse;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=16;" vertex="1" parent="1">
          <mxGeometry x="1360" y="495" width="180" height="60" as="geometry" />
        </mxCell>

        <mxCell id="e1_6" edge="1" parent="1" source="prev_6" target="rv_6" style="endArrow=block;html=1;dashed=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e2_6" edge="1" parent="1" source="rv_6" target="f_rev_6" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e3_6" edge="1" parent="1" source="f_rev_6" target="present_6" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
        <mxCell id="e4_6" edge="1" parent="1" source="present_6" target="end_6" style="endArrow=block;html=1;"><mxGeometry relative="1" as="geometry" /></mxCell>
      </root>
    </mxGraphModel>
  </diagram>

</mxfile>
```

## Google Slides workflow

1. Paste the XML into draw.io (**Extras → Edit Diagram…**). You'll see 6 page tabs at the bottom: `1 · Requirements`, `2 · Specification`, …, `6 · Review`.
2. For each page: **File → Export as → PNG**, check **Current page**, set **Zoom 200%**, **Transparent Background**, **Border Width 20**.
3. In Google Slides (ensure slide size is **Widescreen 16:9** via **File → Page setup**):
   - For each exported PNG: new slide → **Insert → Image → Upload from computer** → pick the matching PNG.
4. Add the slide title as a Slides text box if you want it selectable, or leave the embedded title in the image.

Each phase now gets its own dedicated slide showing: inputs from the previous phase (dashed "from" indicator), the agents + their `Inputs:` tags, the artifact files they produce, the user-approval gate, and a "→ next phase" indicator.

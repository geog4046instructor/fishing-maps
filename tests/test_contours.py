"""Geometry checks for the generated dataset and the interpolation method."""
import importlib.util
import json
from pathlib import Path
import unittest

import numpy as np
from contourpy import contour_generator
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('contours', ROOT / 'scripts/extract-contours.py')
contours = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contours)


class ContourTests(unittest.TestCase):
    def test_parallel_bands_interpolate_at_midpoints(self):
        classes = np.tile(np.repeat(np.arange(5), 40), (60, 1))
        fields = contours.contour_fields(classes, np.array([1., 1.]))
        for depth in contours.DEPTHS:
            lines = contour_generator(x=np.arange(200) + .5, y=np.arange(60), z=fields[depth]).lines(0)
            self.assertEqual(len(lines), 1)
            np.testing.assert_allclose(lines[0][:, 0], depth * 10, atol=.01)

    def test_land_mask_does_not_become_a_depth_boundary(self):
        classes = np.tile(np.repeat(np.arange(5), 40), (80, 1))
        classes[:20] = -1
        classes[60:] = -1
        fields = contours.contour_fields(classes, np.array([1., 1.]))
        for depth in contours.DEPTHS:
            lines = contour_generator(x=np.arange(200) + .5, y=np.arange(80),
                                      z=np.ma.array(fields[depth], mask=classes < 0),
                                      corner_mask=False).lines(0)
            self.assertEqual(len(lines), 1)
            np.testing.assert_allclose(lines[0][:, 0], depth * 10, atol=.01)
            self.assertGreaterEqual(lines[0][:, 1].min(), 20)
            self.assertLessEqual(lines[0][:, 1].max(), 59)

    def test_exported_contours_are_simple_and_do_not_cross(self):
        data = json.loads((ROOT / 'percy-quin/data/depth-contours.geojson').read_text())
        features = data['features']
        lines = [shape(f['geometry']) for f in features]
        for i, line in enumerate(lines):
            self.assertTrue(line.is_valid and line.is_simple, features[i]['properties']['id'])
            for j in range(i):
                self.assertFalse(line.crosses(lines[j]),
                                 (features[i]['properties']['id'], features[j]['properties']['id']))


if __name__ == '__main__':
    unittest.main()
